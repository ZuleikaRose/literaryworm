-- Refer a friend, fifth review (after 165931; every statement is safe to run again).
--
-- * Every set-aside event can be replayed: stripe-webhook keeps the verified event (review_payload), and
--   the dashboard's Retry now runs the webhook's own handler on it again (referral-retry), skipping only
--   the duplicate check; record_referral_event_replay() marks it resolved once it goes through.
-- * Dismiss never hides money owed: dismiss_referral_event() refuses while the referral still owes
--   anything (held sides too) or has a take-back or give-back waiting.
-- * Write off (billing staff, with a reason; referral_write_offs is the audit record): one held side's
--   owed transaction is never made, nor what it would undo, and a waiting round then goes ahead.
-- * The staff list also shows sides owed with an open event, and take-backs and give-backs waiting
--   (waiting_referral_rounds()).
-- * Cut-over: a friend paid if they had a card payment before it, or a non-complimentary, non-gift
--   membership row made before 2026-11-10 (when card payments weren't kept), running or not. Undecided
--   referrals made before the cut-over are set again by that rule.

alter table public.stripe_events add column if not exists review_payload jsonb;

-- Write-offs: the record of what the team chose not to make at Stripe, by whom and why.
create table if not exists public.referral_write_offs (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals (id) on delete cascade,
  side text not null check (side in ('friend', 'referrer')),
  kind text not null check (kind in ('credit', 'credit_check', 'reversal', 'recredit')),
  round smallint not null check (round >= 0),
  cents integer,
  reason text not null check (length(btrim(reason)) between 10 and 500),
  -- No foreign key: the record outlives the staff account.
  written_off_by uuid,
  written_off_at timestamptz not null default now(),
  unique (referral_id, side, kind, round)
);
alter table public.referral_write_offs enable row level security;
revoke all on public.referral_write_offs from public, anon, authenticated;

-- The cut-over ---------------------------------------------------------------------------------------
-- Whether the friend had really paid by p_at: a card payment by then, or a membership row made before
-- 2026-11-10 (card payments weren't kept before that) that isn't complimentary or a gift, running or not.
create or replace function private.referral_friend_paid_before(p_user uuid, p_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.account_private a where a.user_id = p_user and a.card_payment_at is not null and a.card_payment_at <= p_at)
      or exists (select 1 from public.subscriptions s
                 where s.user_id = p_user and not s.complimentary and s.gift_until is null
                   and s.created_at < timestamptz '2026-11-10 00:00:00+00' and s.created_at <= p_at);
$$;
revoke execute on function private.referral_friend_paid_before(uuid, timestamptz) from public, anon, authenticated;

create or replace function private.referral_friend_paid(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.referral_friend_paid_before(p_user, now());
$$;
revoke execute on function private.referral_friend_paid(uuid) from public, anon, authenticated;

-- Undecided referrals made before the cut-over follow the rule as of the cut-over (a released claim of
-- the old code means the friend paid, so it stays on the free month). Decided ones are never touched.
update public.referrals r
set reward_rule = case when private.referral_friend_paid_before(r.referred_id, d.done_at) then 'free_month' else 'percent_20' end
from (select min(done_at) as done_at from private.referral_cutover_done) d
where d.done_at is not null and r.created_at <= d.done_at
  and r.rewarded_at is null and r.friend_credit_id is null and r.referrer_credit_id is null
  and r.reward_rule is distinct from (case when private.referral_friend_paid_before(r.referred_id, d.done_at) then 'free_month' else 'percent_20' end);

-- What's owed (as in 165931, less what's written off) -----------------------------------------------
create or replace function private.referral_pending(p_referral uuid, p_with_held boolean default false)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text, created_at timestamptz)
language sql
stable
set search_path = ''
as $$
  with r as (select * from public.referrals x where x.id = p_referral and x.rewarded_at is not null),
  sides as (
    select r.id, 'friend'::text as side, r.referred_id as user_id, r.friend_credit_cents as cents, r.friend_currency as currency,
           r.friend_credit_id as credit_id, r.friend_reversal_id as reversal_id, r.friend_recredit_id as recredit_id,
           r.friend_needs_review as needs_review, r.friend_checked_round as checked_round,
           r.reversed_at, r.reversal_count, r.reward_rule, r.created_at
    from r
    union all
    select r.id, 'referrer', r.referrer_id, r.referrer_credit_cents, r.referrer_currency,
           r.referrer_credit_id, r.referrer_reversal_id, r.referrer_recredit_id,
           r.referrer_needs_review, r.referrer_checked_round, r.reversed_at, r.reversal_count, r.reward_rule, r.created_at
    from r
  ),
  owed as (
    select s.*,
           case
             when s.reversed_at is null and s.credit_id is null then 'credit'
             when s.reward_rule <> 'percent_20' then null
             when s.reversed_at is not null and s.credit_id is null and s.checked_round < s.reversal_count then 'credit_check'
             when s.reversed_at is not null and s.credit_id is not null and s.reversal_id is null then 'reversal'
             when s.reversed_at is null and s.reversal_count > 0 and s.reversal_id is not null and s.recredit_id is null then 'recredit'
           end as kind
    from sides s
    where s.cents is not null and (p_with_held or not s.needs_review)
  )
  select o.id, o.side, o.kind, o.reversal_count::integer, c.customer_id, o.cents, coalesce(o.currency, 'usd'), o.reward_rule, o.created_at
  from owed o
  join public.stripe_customers c on c.user_id = o.user_id
  where o.kind is not null
    -- Written off by the team (referral_write_offs): that transaction, and what it would undo, are never owed.
    and not exists (
      select 1 from public.referral_write_offs w
      where w.referral_id = o.id and w.side = o.side
        and (w.kind in ('credit', 'credit_check')                                   -- never credited: nothing after it
             or (w.kind = o.kind and w.round = o.reversal_count)                    -- this very transaction
             or (o.kind = 'recredit' and w.kind = 'reversal' and w.round = o.reversal_count)       -- never taken back
             or (o.kind = 'reversal' and w.kind = 'recredit' and w.round = o.reversal_count - 1))  -- never given back
    )
  order by o.side;
$$;
revoke execute on function private.referral_pending(uuid, boolean) from public, anon, authenticated;

revoke execute on function public.reverse_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.reverse_referral_reward(uuid, text) to service_role;
revoke execute on function public.restore_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.restore_referral_reward(uuid, text) to service_role;

-- Write off ------------------------------------------------------------------------------------------
-- Billing staff and admins: one held side's owed transaction is never made (with a reason, kept in
-- referral_write_offs), and a take-back or give-back waiting for it goes ahead. Says what was written off.
create or replace function public.write_off_referral_side(p_referral uuid, p_side text, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  q record;
begin
  if not public.has_staff_role('billing') then
    raise exception 'Only billing staff and admins can write off a referral credit' using errcode = 'insufficient_privilege';
  end if;
  if p_side is null or p_side not in ('friend', 'referrer') then
    raise exception 'Side is friend or referrer' using errcode = 'invalid_parameter_value';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 500 then
    raise exception 'Give a reason of 10 to 500 characters' using errcode = 'invalid_parameter_value';
  end if;
  perform 1 from public.referrals x where x.id = p_referral for update;
  if not exists (select 1 from public.referrals x where x.id = p_referral
                 and case when p_side = 'friend' then x.friend_needs_review else x.referrer_needs_review end) then
    raise exception 'Only a side held for review can be written off' using errcode = 'invalid_parameter_value';
  end if;
  select * into q from private.referral_pending(p_referral, true) o where o.side = p_side limit 1;
  if not found then
    raise exception 'Nothing is owed on that side' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.referral_write_offs (referral_id, side, kind, round, cents, reason, written_off_by)
  values (p_referral, p_side, q.kind, q.round, q.cents, btrim(p_reason), (select auth.uid()))
  on conflict (referral_id, side, kind, round) do nothing;
  if p_side = 'friend' then
    update public.referrals set friend_needs_review = false, friend_failures = 0, friend_retry_requested_at = null where id = p_referral;
  else
    update public.referrals set referrer_needs_review = false, referrer_failures = 0, referrer_retry_requested_at = null where id = p_referral;
  end if;
  perform private.referral_advance(p_referral);
  return q.kind;
end;
$$;
revoke execute on function public.write_off_referral_side(uuid, text, text) from public, anon;
grant execute on function public.write_off_referral_side(uuid, text, text) to authenticated, service_role;

-- Recovery -------------------------------------------------------------------------------------------
-- For referral-retry: clears a referral's held sides (retry requested) and says whose it is and whether
-- its reward is decided (an undecided one has nothing to make yet: its set-aside event is replayed).
drop function if exists public.referral_retry_start(uuid);
create function public.referral_retry_start(p_referral uuid)
returns table (referred_id uuid, decided boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.referrals x
  set friend_retry_requested_at = case when x.friend_needs_review then now() else x.friend_retry_requested_at end,
      referrer_retry_requested_at = case when x.referrer_needs_review then now() else x.referrer_retry_requested_at end,
      friend_failures = case when x.friend_needs_review then 0 else x.friend_failures end,
      referrer_failures = case when x.referrer_needs_review then 0 else x.referrer_failures end,
      friend_needs_review = false, referrer_needs_review = false
  where x.id = p_referral
  returning x.referred_id, x.rewarded_at is not null;
end;
$$;
revoke execute on function public.referral_retry_start(uuid) from public, anon, authenticated;
grant execute on function public.referral_retry_start(uuid) to service_role;

-- For referral-retry, after replaying a set-aside event: resolved when it went through with nothing set
-- aside again; otherwise the new reason is kept. Says whether it's resolved.
create or replace function public.record_referral_event_replay(p_event text, p_ok boolean, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.stripe_events set review_resolved_at = now() where id = p_event and review_reason is not null;
  else
    update public.stripe_events set review_reason = left(coalesce(p_reason, review_reason), 500) where id = p_event;
  end if;
  return p_ok;
end;
$$;
revoke execute on function public.record_referral_event_replay(text, boolean, text) from public, anon, authenticated;
grant execute on function public.record_referral_event_replay(text, boolean, text) to service_role;

-- Whether a referral still owes anything at Stripe (held sides too) or has a round waiting.
create or replace function private.referral_open(p_referral uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from private.referral_pending(p_referral, true))
      or exists (select 1 from public.referrals r where r.id = p_referral
                 and (r.takeback_requested_at is not null or r.restore_requested_at is not null));
$$;
revoke execute on function private.referral_open(uuid) from public, anon, authenticated;

-- A set-aside event leaves the list only when its referral owes nothing and has nothing waiting.
create or replace function public.dismiss_referral_event(p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral uuid;
  v_done integer;
begin
  select coalesce(e.review_referral, (select x.id from public.referrals x where x.referred_id = e.review_referred_user))
    into v_referral
  from public.stripe_events e where e.id = p_event;
  if v_referral is not null and private.referral_open(v_referral) then
    raise exception 'referral_still_owed: this referral still owes something at Stripe or has a take-back or give-back waiting. Use Retry now, or Write off a held side.'
      using errcode = 'P0001';
  end if;
  update public.stripe_events set review_resolved_at = now()
  where id = p_event and review_reason is not null and review_resolved_at is null;
  get diagnostics v_done = row_count;
  return v_done > 0;
end;
$$;
revoke execute on function public.dismiss_referral_event(text) from public, anon, authenticated;
grant execute on function public.dismiss_referral_event(text) to service_role;

-- The staff list ----------------------------------------------------------------------------------------
-- Held sides, sides cleared and not yet settled, and sides still owed while an event about their
-- referral is open (state 'held', 'retry_requested' or 'event_open').
drop function if exists public.parked_referral_credits();
create function public.parked_referral_credits()
returns table (referral_id uuid, side text, cents integer, currency text, last_error text, failed_at timestamptz, state text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('billing') then
    raise exception 'Only billing staff and admins can see this' using errcode = 'insufficient_privilege';
  end if;
  return query
  with open_events as (
    select distinct coalesce(e.review_referral, (select x.id from public.referrals x where x.referred_id = e.review_referred_user)) as referral_id
    from public.stripe_events e
    where e.needs_review and e.review_reason is not null and e.review_resolved_at is null
  ),
  sides as (
    select r.id, 'friend'::text as side, r.friend_credit_cents as cents, coalesce(r.friend_currency, 'usd') as currency,
           r.friend_last_error as last_error, r.friend_failed_at as failed_at, r.friend_needs_review as held,
           r.friend_retry_requested_at as retry_at
    from public.referrals r
    union all
    select r.id, 'referrer', r.referrer_credit_cents, coalesce(r.referrer_currency, 'usd'), r.referrer_last_error, r.referrer_failed_at,
           r.referrer_needs_review, r.referrer_retry_requested_at
    from public.referrals r
  )
  select s.id, s.side, s.cents, s.currency, s.last_error, s.failed_at,
         case when s.held then 'held' when s.retry_at is not null then 'retry_requested' else 'event_open' end
  from sides s
  where s.held
     or ((s.retry_at is not null or s.id in (select o.referral_id from open_events o))
         and exists (select 1 from private.referral_pending(s.id, true) q where q.side = s.side))
  order by 6 desc nulls last;
end;
$$;
revoke execute on function public.parked_referral_credits() from public, anon;
grant execute on function public.parked_referral_credits() to authenticated, service_role;

-- Take-backs and give-backs waiting for a side of the round, and which sides hold them up.
create or replace function public.waiting_referral_rounds()
returns table (referral_id uuid, kind text, since timestamptz, held_sides text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('billing') then
    raise exception 'Only billing staff and admins can see this' using errcode = 'insufficient_privilege';
  end if;
  return query
  select r.id,
         case when r.takeback_requested_at is not null then 'take_back' else 'give_back' end,
         coalesce(r.takeback_requested_at, r.restore_requested_at),
         nullif(concat_ws(', ', case when r.friend_needs_review then 'friend' end, case when r.referrer_needs_review then 'referrer' end), '')
  from public.referrals r
  where r.takeback_requested_at is not null or r.restore_requested_at is not null
  order by 3;
end;
$$;
revoke execute on function public.waiting_referral_rounds() from public, anon;
grant execute on function public.waiting_referral_rounds() to authenticated, service_role;
