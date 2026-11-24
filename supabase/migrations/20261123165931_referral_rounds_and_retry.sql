-- Refer a friend, fourth review (after 160955; every statement is safe to run again).
--
-- * Rounds never overlap, held sides included: a take-back (full refund or dispute) waits while any
--   side's give-back is still owed, held for review or not, and a give-back (won dispute) waits while any
--   side's take-back is. A request that has to wait is kept (takeback_requested_at, restore_requested_at)
--   and carried out by private.referral_advance() once the last transaction it waits for is recorded, so
--   nothing is taken back twice and no refund or won dispute is lost. A won dispute cancels a take-back
--   still waiting, and a refund cancels a give-back still waiting.
-- * Recovery: a held side cleared by the team (clear_referral_review(), or the staff dashboard's
--   Retry now through the referral-retry function: referral_retry_start() and referral_owed()) is marked
--   retry_requested and stays on the dashboard (parked_referral_credits(), state 'retry_requested')
--   until it's actually settled. Stripe's own resend of an event can't do this: it keeps the event id,
--   which stripe-webhook has already handled.
-- * Events stripe-webhook set aside for a referral (Stripe refused the key, or the database function
--   wasn't there) are kept with why and which referral (stripe_events.review_reason, review_referral,
--   review_referred_user) and listed for billing staff (referral_events_to_review(); dismissed with
--   dismiss_referral_event() through referral-retry once handled).
-- * The cut-over counts only a real payment: card_payment_at, or a running membership past its free
--   week that isn't a gift or complimentary. A friend still on the free week (or on a gift) was moved to
--   the free month by 160955's wider test; those undecided referrals are put back on 20%.
-- * Affiliate credits are known transaction ids too (referral_transaction_known()).

alter table public.referrals
  add column if not exists friend_retry_requested_at timestamptz,
  add column if not exists referrer_retry_requested_at timestamptz,
  add column if not exists takeback_requested_at timestamptz,
  add column if not exists restore_requested_at timestamptz;

alter table public.stripe_events
  add column if not exists review_reason text check (review_reason is null or length(review_reason) <= 500),
  add column if not exists review_referral uuid,
  add column if not exists review_referred_user uuid,
  add column if not exists review_resolved_at timestamptz;

-- The cut-over -------------------------------------------------------------------------------------
-- Whether the friend had really paid before the change: a card payment (kept since 2026-11-10), or,
-- for payments before that, a running membership past its free week that isn't a gift or complimentary
-- (Stripe charged it). A free week or a gift alone is not a payment (Terms, 30).
create or replace function private.referral_friend_paid(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.account_private a where a.user_id = p_user and a.card_payment_at is not null)
      or exists (select 1 from public.subscriptions s
                 where s.user_id = p_user and not s.complimentary and s.stripe_subscription_id is not null
                   and s.status in ('active', 'past_due', 'paused') and s.gift_until is null
                   and (s.trial_until is null or s.trial_until < now()));
$$;
revoke execute on function private.referral_friend_paid(uuid) from public, anon, authenticated;

create or replace function private.referral_cutover(p_again boolean default false)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_kept integer;
begin
  if not p_again and exists (select 1 from private.referral_cutover_done) then
    return 0;
  end if;
  update public.referrals r
  set reward_rule = 'free_month'
  where r.reward_rule <> 'free_month'
    and (r.rewarded_at is not null or r.friend_credit_id is not null or r.referrer_credit_id is not null
         or private.referral_friend_paid(r.referred_id));
  get diagnostics v_kept = row_count;
  insert into private.referral_cutover_done default values on conflict do nothing;
  return v_kept;
end;
$$;
revoke execute on function private.referral_cutover(boolean) from public, anon, authenticated;

-- 160955 counted any membership row as paid: an undecided referral it moved for a friend who hasn't
-- really paid goes back to 20% (undecided, so nothing was credited under either rule).
update public.referrals r
set reward_rule = 'percent_20'
where r.reward_rule = 'free_month' and r.rewarded_at is null
  and r.friend_credit_id is null and r.referrer_credit_id is null
  and not private.referral_friend_paid(r.referred_id);

-- Known transaction ids ----------------------------------------------------------------------------
create or replace function private.referral_txn_used(p_txn text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.referrals r
    where p_txn in (r.friend_credit_id, r.referrer_credit_id, r.friend_reversal_id, r.referrer_reversal_id,
                    r.friend_recredit_id, r.referrer_recredit_id)
  ) or exists (select 1 from public.affiliate_referrals a where a.credit_id = p_txn);
$$;
revoke execute on function private.referral_txn_used(text) from public, anon, authenticated;

-- What's owed --------------------------------------------------------------------------------------
-- As in 160955, plus p_with_held: true also lists sides held for review (the round gates count them).
drop function if exists private.referral_pending(uuid);
drop function if exists private.referral_pending(uuid, boolean);
-- Everything a decided referral still needs at Stripe, from its recorded state: one row per side.
create function private.referral_pending(p_referral uuid, p_with_held boolean default false)
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
  order by o.side;
$$;
revoke execute on function private.referral_pending(uuid, boolean) from public, anon, authenticated;

-- Carries out a take-back or give-back that had to wait, once nothing of the current round is owed
-- (held sides included). Called after every recorded transaction or credit check, and by the gates.
create or replace function private.referral_advance(p_referral uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r public.referrals;
begin
  select * into r from public.referrals x where x.id = p_referral for update;
  if r.id is null or r.reward_rule <> 'percent_20' or r.rewarded_at is null then
    return;
  end if;
  if r.takeback_requested_at is not null and r.reversed_at is null
     and not exists (select 1 from private.referral_pending(r.id, true) q where q.kind = 'recredit') then
    update public.referrals
    set reversed_at = now(), reversal_count = reversal_count + 1, friend_reversal_id = null, referrer_reversal_id = null,
        takeback_requested_at = null
    where id = r.id;
  elsif r.restore_requested_at is not null and r.reversed_at is not null
     and not exists (select 1 from private.referral_pending(r.id, true) q where q.kind in ('reversal', 'credit_check')) then
    update public.referrals
    set reversed_at = null, friend_recredit_id = null, referrer_recredit_id = null, restore_requested_at = null
    where id = r.id;
  end if;
end;
$$;
revoke execute on function private.referral_advance(uuid) from public, anon, authenticated;

-- For stripe-webhook, when the invoice that earned a 20% reward is fully refunded or disputed: both
-- credits are taken back in a new round, once nothing of the last one is still owed (held sides too);
-- until then the take-back waits. A give-back still waiting is cancelled. Says what Stripe still needs.
create or replace function public.reverse_referral_reward(p_referred uuid, p_invoice text)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.referrals;
begin
  select * into r from public.referrals x
  where x.referred_id = p_referred and x.reward_rule = 'percent_20' and x.rewarded_at is not null
    and x.first_invoice_id is not null and x.first_invoice_id = p_invoice
  for update;
  if r.id is null then
    return;
  end if;
  if r.reversed_at is null then
    update public.referrals set takeback_requested_at = coalesce(takeback_requested_at, now()), restore_requested_at = null where id = r.id;
  else
    -- Already taken back this round: a refund after a won dispute that's still waiting keeps it so.
    update public.referrals set restore_requested_at = null where id = r.id;
  end if;
  perform private.referral_advance(r.id);
  return query select * from private.referral_pending(r.id);
end;
$$;

-- For stripe-webhook, when a dispute of that invoice is closed in our favour: the credits come back once
-- the take-back is all recorded (held sides too); until then the give-back waits. A take-back still
-- waiting is cancelled instead.
create or replace function public.restore_referral_reward(p_referred uuid, p_invoice text)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.referrals;
begin
  select * into r from public.referrals x
  where x.referred_id = p_referred and x.reward_rule = 'percent_20' and x.first_invoice_id is not null and x.first_invoice_id = p_invoice
  for update;
  if r.id is null then
    return;
  end if;
  if r.reversed_at is not null then
    update public.referrals set restore_requested_at = coalesce(restore_requested_at, now()), takeback_requested_at = null where id = r.id;
  else
    update public.referrals set takeback_requested_at = null where id = r.id;
  end if;
  perform private.referral_advance(r.id);
  return query select * from private.referral_pending(r.id);
end;
$$;

-- Records one Stripe balance transaction the moment it's made (as in 160955), clears that side's retry
-- request, and lets a waiting take-back or give-back go ahead.
create or replace function public.record_referral_transaction(p_referral uuid, p_side text, p_kind text, p_round integer, p_txn text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
begin
  if p_side is null or p_side not in ('friend', 'referrer') or p_kind is null or p_kind not in ('credit', 'reversal', 'recredit')
     or p_txn is null or p_txn !~ '^cbtxn_[A-Za-z0-9]+$' then
    raise exception 'Not a referral transaction' using errcode = 'invalid_parameter_value';
  end if;
  -- One transaction, one slot: an id already recorded anywhere is refused (stripe-webhook counts it as a
  -- permanent failure, so it's set aside for the team rather than recorded twice).
  if exists (
    select 1 from public.referrals r
    where p_txn in (r.friend_credit_id, r.referrer_credit_id, r.friend_reversal_id, r.referrer_reversal_id, r.friend_recredit_id, r.referrer_recredit_id)
      -- (the same id again in its own slot is a repeat, not a reuse; an empty slot never matches)
      and not (r.id = p_referral and p_txn is not distinct from case
        when p_kind = 'credit' and p_side = 'friend' then r.friend_credit_id
        when p_kind = 'credit' then r.referrer_credit_id
        when p_kind = 'reversal' and p_side = 'friend' then r.friend_reversal_id
        when p_kind = 'reversal' then r.referrer_reversal_id
        when p_side = 'friend' then r.friend_recredit_id
        else r.referrer_recredit_id end)
  ) then
    raise exception 'referral_txn_reused: % is already recorded on another referral or slot', p_txn using errcode = 'P0001';
  end if;
  if p_kind = 'credit' and p_side = 'friend' then
    update public.referrals set friend_credit_id = p_txn, friend_failures = 0, friend_retry_requested_at = null where id = p_referral and friend_credit_id is null;
  elsif p_kind = 'credit' then
    update public.referrals set referrer_credit_id = p_txn, referrer_failures = 0, referrer_retry_requested_at = null where id = p_referral and referrer_credit_id is null;
  elsif p_kind = 'reversal' and p_side = 'friend' then
    update public.referrals set friend_reversal_id = p_txn, friend_failures = 0, friend_retry_requested_at = null where id = p_referral and reversal_count = p_round and friend_reversal_id is null;
  elsif p_kind = 'reversal' then
    update public.referrals set referrer_reversal_id = p_txn, referrer_failures = 0, referrer_retry_requested_at = null where id = p_referral and reversal_count = p_round and referrer_reversal_id is null;
  elsif p_side = 'friend' then
    update public.referrals set friend_recredit_id = p_txn, friend_failures = 0, friend_retry_requested_at = null where id = p_referral and reversal_count = p_round and friend_recredit_id is null;
  else
    update public.referrals set referrer_recredit_id = p_txn, referrer_failures = 0, referrer_retry_requested_at = null where id = p_referral and reversal_count = p_round and referrer_recredit_id is null;
  end if;
  get diagnostics v_done = row_count;
  -- A take-back or give-back that waited for this one may go ahead now.
  perform private.referral_advance(p_referral);
  return v_done > 0;
end;
$$;
revoke execute on function public.record_referral_transaction(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_referral_transaction(uuid, text, text, integer, text) to service_role;

create or replace function public.record_referral_check(p_referral uuid, p_side text, p_round integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.referrals
  set friend_checked_round = case when p_side = 'friend' then greatest(friend_checked_round, p_round) else friend_checked_round end,
      referrer_checked_round = case when p_side = 'referrer' then greatest(referrer_checked_round, p_round) else referrer_checked_round end
  where id = p_referral and p_side in ('friend', 'referrer') and p_round between 0 and reversal_count;
  perform private.referral_advance(p_referral);
end;
$$;
revoke execute on function public.record_referral_check(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_referral_check(uuid, text, integer) to service_role;

-- Recovery -----------------------------------------------------------------------------------------
-- Clears a side held for review and marks it retry_requested; it stays on the dashboard until settled.
-- Service role only (the SQL editor); the dashboard's Retry now does this and tries it at once.
create or replace function public.clear_referral_review(p_referral uuid, p_side text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
begin
  if p_side = 'friend' then
    update public.referrals set friend_needs_review = false, friend_failures = 0, friend_retry_requested_at = now()
    where id = p_referral and friend_needs_review;
  elsif p_side = 'referrer' then
    update public.referrals set referrer_needs_review = false, referrer_failures = 0, referrer_retry_requested_at = now()
    where id = p_referral and referrer_needs_review;
  else
    raise exception 'Side is friend or referrer' using errcode = 'invalid_parameter_value';
  end if;
  get diagnostics v_done = row_count;
  return v_done > 0;
end;
$$;
revoke execute on function public.clear_referral_review(uuid, text) from public, anon, authenticated;
grant execute on function public.clear_referral_review(uuid, text) to service_role;

-- For referral-retry (billing staff's Retry now): clears every held side of a referral, marks them
-- retry_requested, and says whose referral it is (null if there's no such referral).
create or replace function public.referral_retry_start(p_referral uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  update public.referrals
  set friend_retry_requested_at = case when friend_needs_review then now() else friend_retry_requested_at end,
      referrer_retry_requested_at = case when referrer_needs_review then now() else referrer_retry_requested_at end,
      friend_failures = case when friend_needs_review then 0 else friend_failures end,
      referrer_failures = case when referrer_needs_review then 0 else referrer_failures end,
      friend_needs_review = false, referrer_needs_review = false
  where id = p_referral
  returning referred_id into v_user;
  return v_user;
end;
$$;
revoke execute on function public.referral_retry_start(uuid) from public, anon, authenticated;
grant execute on function public.referral_retry_start(uuid) to service_role;

-- For referral-retry: what a referral still needs at Stripe (after carrying out anything waiting).
create or replace function public.referral_owed(p_referral uuid)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.referral_advance(p_referral);
  return query select * from private.referral_pending(p_referral);
end;
$$;
revoke execute on function public.referral_owed(uuid) from public, anon, authenticated;
grant execute on function public.referral_owed(uuid) to service_role;

-- For billing staff and admins: every referral side held for review, or cleared and not yet settled
-- (state 'held' or 'retry_requested'), with what went wrong. No names or emails.
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
    select r.id, 'friend'::text, r.friend_credit_cents, coalesce(r.friend_currency, 'usd'), r.friend_last_error, r.friend_failed_at,
           case when r.friend_needs_review then 'held' else 'retry_requested' end
    from public.referrals r
    where r.friend_needs_review
       or (r.friend_retry_requested_at is not null
           and exists (select 1 from private.referral_pending(r.id, true) q where q.side = 'friend'))
    union all
    select r.id, 'referrer', r.referrer_credit_cents, coalesce(r.referrer_currency, 'usd'), r.referrer_last_error, r.referrer_failed_at,
           case when r.referrer_needs_review then 'held' else 'retry_requested' end
    from public.referrals r
    where r.referrer_needs_review
       or (r.referrer_retry_requested_at is not null
           and exists (select 1 from private.referral_pending(r.id, true) q where q.side = 'referrer'))
    order by 6 desc nulls last;
end;
$$;
revoke execute on function public.parked_referral_credits() from public, anon;
grant execute on function public.parked_referral_credits() to authenticated, service_role;

-- For billing staff and admins: Stripe events stripe-webhook set aside for a referral (our key refused,
-- or a database function missing), not yet dismissed, with why and the referral when it's known.
create or replace function public.referral_events_to_review()
returns table (event_id text, event_type text, received_at timestamptz, reason text, referral_id uuid)
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
    select e.id, e.type, e.received_at, e.review_reason,
           coalesce(e.review_referral, (select x.id from public.referrals x where x.referred_id = e.review_referred_user))
    from public.stripe_events e
    where e.needs_review and e.review_reason is not null and e.review_resolved_at is null
    order by e.received_at desc
    limit 100;
end;
$$;
revoke execute on function public.referral_events_to_review() from public, anon;
grant execute on function public.referral_events_to_review() to authenticated, service_role;

-- For referral-retry: a set-aside referral event the team has handled leaves the list. Says whether it did.
create or replace function public.dismiss_referral_event(p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
begin
  update public.stripe_events set review_resolved_at = now()
  where id = p_event and review_reason is not null and review_resolved_at is null;
  get diagnostics v_done = row_count;
  return v_done > 0;
end;
$$;
revoke execute on function public.dismiss_referral_event(text) from public, anon, authenticated;
grant execute on function public.dismiss_referral_event(text) to service_role;
