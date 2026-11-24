-- Refer a friend, round 2 and 3 of the review fixes (on top of 6843, whichever version of it was applied:
-- every statement here is safe to run again). Production applies 6843 and this back to back.
--
-- * Each side's Stripe transaction is recorded the moment it's made (record_referral_transaction()) and a
--   transaction id is recorded on one referral slot only (unique, checked across every id column).
-- * Every claim, take-back and give-back says everything still owed (private.referral_pending()); during a
--   take-back an unrecorded credit is looked for at Stripe ('credit_check', record_referral_check()); a
--   give-back waits for the round's reversals, and a new round for the give-backs.
-- * A side is set aside (needs_review) only after 5 permanent Stripe failures in a row
--   (note_referral_failure(), with the error and when); billing staff see them on the dashboard
--   (parked_referral_credits()), and clear_referral_review() (service role) lets the next event retry it.
-- * referral_takeback_possible() lets refund and dispute events skip charges that can't matter.
-- * The cut-over runs once (private.referral_cutover_done). If a referral has already been decided under
--   the 20% rule, the marker is set first and the cut-over isn't run again; otherwise it runs with the
--   wider test (a paid membership row counts as paid too, for payments before card_payment_at).
-- * The member's and the friend's views say "on your account" only once that side's credit is recorded
--   (my_referrals(), my_invitation()).

alter table public.referrals
  add column if not exists friend_failures smallint not null default 0 check (friend_failures >= 0),
  add column if not exists referrer_failures smallint not null default 0 check (referrer_failures >= 0),
  add column if not exists friend_needs_review boolean not null default false,
  add column if not exists referrer_needs_review boolean not null default false,
  add column if not exists friend_checked_round smallint not null default 0 check (friend_checked_round >= 0),
  add column if not exists referrer_checked_round smallint not null default 0 check (referrer_checked_round >= 0),
  -- The last permanent Stripe failure for each side, for the team (never shown to members).
  add column if not exists friend_last_error text check (friend_last_error is null or length(friend_last_error) <= 500),
  add column if not exists referrer_last_error text check (referrer_last_error is null or length(referrer_last_error) <= 500),
  add column if not exists friend_failed_at timestamptz,
  add column if not exists referrer_failed_at timestamptz;

-- A Stripe balance transaction belongs to one slot of one referral: the unique indexes on the credit
-- ids are made CONCURRENTLY in 165932 and 165934.

-- Whether a Stripe balance transaction id is already recorded anywhere on any referral.
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
  );
$$;
revoke execute on function private.referral_txn_used(text) from public, anon, authenticated;

-- For stripe-webhook's search for an old free month made without a key: skip ids already recorded.
create or replace function public.referral_transaction_known(p_txn text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.referral_txn_used(p_txn);
$$;
revoke execute on function public.referral_transaction_known(text) from public, anon, authenticated;
grant execute on function public.referral_transaction_known(text) to service_role;

create table if not exists private.referral_cutover_done (
  done_at timestamptz primary key default now()
);
alter table private.referral_cutover_done enable row level security;
revoke all on private.referral_cutover_done from public, anon, authenticated;

-- Never run the cut-over twice over decisions already made under the 20% rule: if there are any, set the
-- marker first, so the call below does nothing.
insert into private.referral_cutover_done (done_at)
select now() where exists (select 1 from public.referrals where reward_rule = 'percent_20' and rewarded_at is not null)
  and not exists (select 1 from private.referral_cutover_done);

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
    and (r.rewarded_at is not null
         or r.friend_credit_id is not null
         or r.referrer_credit_id is not null
         or exists (select 1 from public.account_private a where a.user_id = r.referred_id and a.card_payment_at is not null)
         -- card_payment_at was only kept from 2026-11-10: a paid membership row counts as paid too.
         or exists (select 1 from public.subscriptions s where s.user_id = r.referred_id and not s.complimentary));
  get diagnostics v_kept = row_count;
  insert into private.referral_cutover_done default values on conflict do nothing;
  return v_kept;
end;
$$;
revoke execute on function private.referral_cutover(boolean) from public, anon, authenticated;
drop function if exists private.referral_cutover();

select private.referral_cutover();

-- The owed rows gain the referral's created_at (an old free month is only looked for after it), so the
-- functions returning them are made again.
drop function if exists public.claim_referral_reward(uuid);
drop function if exists public.claim_referral_reward(uuid, text);
drop function if exists public.reverse_referral_reward(uuid, text);
drop function if exists public.restore_referral_reward(uuid, text);
drop function if exists private.referral_pending(uuid);

-- Everything a decided referral still needs at Stripe, from its recorded state: one row per side.
--   credit        the reward (a negative balance), while not taken back and not yet recorded;
--   credit_check  while taken back, a side whose credit isn't recorded: look for it at Stripe once per round;
--   reversal      taking a recorded credit back in round n (a positive balance);
--   recredit      the reward again after a won dispute, for a side whose round-n reversal is recorded.
-- A side set aside for review is skipped, and a free month is never taken back.
create function private.referral_pending(p_referral uuid)
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
    where s.cents is not null and not s.needs_review
  )
  select o.id, o.side, o.kind, o.reversal_count::integer, c.customer_id, o.cents, coalesce(o.currency, 'usd'), o.reward_rule, o.created_at
  from owed o
  join public.stripe_customers c on c.user_id = o.user_id
  where o.kind is not null
  order by o.side;
$$;
revoke execute on function private.referral_pending(uuid) from public, anon, authenticated;

-- For stripe-webhook, when an invited member's payment goes through: decides their referral's reward
-- once (on the first payment; p_invoice is its invoice), then says which Stripe transactions it still
-- needs. Called again on a retry or a later paid invoice, it only gives what's still missing.
create function public.claim_referral_reward(p_referred uuid, p_invoice text default null)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.referrals;
  v_friend   integer;
  v_fcur     text;
  v_rcents   integer;
  v_rcur     text;
  v_skip     text;
begin
  select * into r from public.referrals x where x.referred_id = p_referred for update;
  if r.id is null then
    return;
  end if;
  if r.rewarded_at is null then
    -- Staff are never billed, so a staff member who was invited isn't rewarded either.
    if exists (select 1 from public.staff_roles s where s.user_id = p_referred) then
      update public.referrals set rewarded_at = now(), referrer_skipped = 'staff' where id = r.id;
      return;
    end if;
    select private.referral_side_cents(r.reward_rule, p.price_cents, p.yearly_price_cents, s.billing_interval), lower(p.currency)
      into v_friend, v_fcur
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    join public.stripe_customers c on c.user_id = s.user_id
    where s.user_id = p_referred;
    if v_friend is null then
      -- No paid membership to credit yet: wait for the next payment.
      return;
    end if;
    -- Two friends paying at once are counted one after the other, so the inviter's limit holds.
    perform pg_advisory_xact_lock(hashtextextended('referral-reward:' || r.referrer_id::text, 0));
    if exists (select 1 from public.staff_roles s where s.user_id = r.referrer_id) then
      v_skip := 'staff';
    elsif r.reward_rule = 'free_month'
      and (select count(*) from public.referrals x
           where x.referrer_id = r.referrer_id and x.reward_rule = 'free_month' and x.referrer_credit_cents is not null) >= 2 then
      -- The old offer: 2 free months in all from inviting friends.
      v_skip := 'limit_reached';
    elsif r.reward_rule = 'percent_20'
      and exists (select 1 from public.referrals x
                  where x.referrer_id = r.referrer_id and x.id <> r.id and x.reward_rule = 'percent_20'
                    and (x.referrer_credit_cents is not null or x.referrer_credit_id is not null)) then
      -- 20% once per account for inviting: already decided, or already made at Stripe. Free months don't count.
      v_skip := 'already_credited';
    else
      select private.referral_side_cents(r.reward_rule, p.price_cents, p.yearly_price_cents, s.billing_interval), lower(p.currency)
        into v_rcents, v_rcur
      from public.subscriptions s join public.plans p on p.id = s.plan_id
      join public.stripe_customers c on c.user_id = s.user_id
      where s.user_id = r.referrer_id and s.status in ('active', 'past_due', 'paused') and not s.complimentary;
      if v_rcents is null then v_skip := 'no_membership'; end if;
    end if;
    update public.referrals
    set rewarded_at = now(), friend_credit_cents = v_friend, friend_currency = v_fcur,
        referrer_credit_cents = case when v_skip is null then v_rcents end,
        referrer_currency = case when v_skip is null then v_rcur end,
        referrer_skipped = v_skip,
        first_invoice_id = case when p_invoice ~ '^in_[A-Za-z0-9]+$' then p_invoice end
    where id = r.id;
  end if;
  return query select * from private.referral_pending(r.id);
end;
$$;
revoke execute on function public.claim_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_referral_reward(uuid, text) to service_role;

-- For stripe-webhook, when the invoice that earned a 20% reward is fully refunded or disputed: takes
-- both credits back (once per round; a side not credited yet is then never credited), and says what
-- Stripe still needs. Never a free month, and nothing for any other invoice.
create function public.reverse_referral_reward(p_referred uuid, p_invoice text)
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
  -- A new round starts only once the last one is all recorded: no side still owed its credit again.
  if r.reversed_at is null and not exists (select 1 from private.referral_pending(r.id) q where q.kind = 'recredit') then
    update public.referrals
    set reversed_at = now(), reversal_count = reversal_count + 1, friend_reversal_id = null, referrer_reversal_id = null
    where id = r.id;
  end if;
  return query select * from private.referral_pending(r.id);
end;
$$;
revoke execute on function public.reverse_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.reverse_referral_reward(uuid, text) to service_role;

-- For stripe-webhook, when a dispute of that invoice is closed in our favour: the credits come back
-- (a side that was never credited is credited now).
create function public.restore_referral_reward(p_referred uuid, p_invoice text)
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
  -- Given back only once the take-back is all recorded (no reversal or credit check still owed), so a
  -- reversal made but not recorded is found first and given back too, never made twice.
  if r.reversed_at is not null
     and not exists (select 1 from private.referral_pending(r.id) q where q.kind in ('reversal', 'credit_check')) then
    update public.referrals set reversed_at = null, friend_recredit_id = null, referrer_recredit_id = null where id = r.id;
  end if;
  return query select * from private.referral_pending(r.id);
end;
$$;
revoke execute on function public.restore_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.restore_referral_reward(uuid, text) to service_role;

-- Records one Stripe balance transaction the moment it's made, so no retry makes it again. Fills only
-- the empty slot of the round it was made for; says whether it did.
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
    update public.referrals set friend_credit_id = p_txn, friend_failures = 0 where id = p_referral and friend_credit_id is null;
  elsif p_kind = 'credit' then
    update public.referrals set referrer_credit_id = p_txn, referrer_failures = 0 where id = p_referral and referrer_credit_id is null;
  elsif p_kind = 'reversal' and p_side = 'friend' then
    update public.referrals set friend_reversal_id = p_txn, friend_failures = 0 where id = p_referral and reversal_count = p_round and friend_reversal_id is null;
  elsif p_kind = 'reversal' then
    update public.referrals set referrer_reversal_id = p_txn, referrer_failures = 0 where id = p_referral and reversal_count = p_round and referrer_reversal_id is null;
  elsif p_side = 'friend' then
    update public.referrals set friend_recredit_id = p_txn, friend_failures = 0 where id = p_referral and reversal_count = p_round and friend_recredit_id is null;
  else
    update public.referrals set referrer_recredit_id = p_txn, referrer_failures = 0 where id = p_referral and reversal_count = p_round and referrer_recredit_id is null;
  end if;
  get diagnostics v_done = row_count;
  return v_done > 0;
end;
$$;
revoke execute on function public.record_referral_transaction(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_referral_transaction(uuid, text, text, integer, text) to service_role;

-- A credit looked for at Stripe during a take-back round and not found: don't look again this round.
create or replace function public.record_referral_check(p_referral uuid, p_side text, p_round integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.referrals
  set friend_checked_round = case when p_side = 'friend' then greatest(friend_checked_round, p_round) else friend_checked_round end,
      referrer_checked_round = case when p_side = 'referrer' then greatest(referrer_checked_round, p_round) else referrer_checked_round end
  where id = p_referral and p_side in ('friend', 'referrer') and p_round between 0 and reversal_count;
$$;
revoke execute on function public.record_referral_check(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_referral_check(uuid, text, integer) to service_role;

-- A side's Stripe transaction failed permanently (stripe-webhook never counts temporary failures): counted,
-- with the error and when, and at 5 in a row the side is set aside for the team (then skipped, so the
-- friend's later events go through). Says whether it's set aside.
drop function if exists public.note_referral_failure(uuid, text);
create or replace function public.note_referral_failure(p_referral uuid, p_side text, p_error text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_review boolean;
  v_error  text := left(coalesce(p_error, 'unknown'), 500);
begin
  if p_side = 'friend' then
    update public.referrals
    set friend_failures = least(friend_failures + 1, 32767), friend_needs_review = friend_needs_review or friend_failures + 1 >= 5,
        friend_last_error = v_error, friend_failed_at = now()
    where id = p_referral returning friend_needs_review into v_review;
  elsif p_side = 'referrer' then
    update public.referrals
    set referrer_failures = least(referrer_failures + 1, 32767), referrer_needs_review = referrer_needs_review or referrer_failures + 1 >= 5,
        referrer_last_error = v_error, referrer_failed_at = now()
    where id = p_referral returning referrer_needs_review into v_review;
  end if;
  return coalesce(v_review, false);
end;
$$;
revoke execute on function public.note_referral_failure(uuid, text, text) from public, anon, authenticated;
grant execute on function public.note_referral_failure(uuid, text, text) to service_role;

-- Clears a side set aside for review (after the team has fixed the cause), so the friend's next event, or
-- the next retry, tries it again. Service role only: run it from the SQL editor (supabase/README.md).
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
    update public.referrals set friend_needs_review = false, friend_failures = 0 where id = p_referral and friend_needs_review;
  elsif p_side = 'referrer' then
    update public.referrals set referrer_needs_review = false, referrer_failures = 0 where id = p_referral and referrer_needs_review;
  else
    raise exception 'Side is friend or referrer' using errcode = 'invalid_parameter_value';
  end if;
  get diagnostics v_done = row_count;
  return v_done > 0;
end;
$$;
revoke execute on function public.clear_referral_review(uuid, text) from public, anon, authenticated;
grant execute on function public.clear_referral_review(uuid, text) to service_role;

-- For billing staff and admins (the dashboard): every referral side set aside for review, with what went
-- wrong. No names or emails; the referral id is enough to clear it.
create or replace function public.parked_referral_credits()
returns table (referral_id uuid, side text, cents integer, currency text, last_error text, failed_at timestamptz)
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
    select r.id, 'friend'::text, r.friend_credit_cents, coalesce(r.friend_currency, 'usd'), r.friend_last_error, r.friend_failed_at
    from public.referrals r where r.friend_needs_review
    union all
    select r.id, 'referrer', r.referrer_credit_cents, coalesce(r.referrer_currency, 'usd'), r.referrer_last_error, r.referrer_failed_at
    from public.referrals r where r.referrer_needs_review
    order by 6 desc nulls last;
end;
$$;
revoke execute on function public.parked_referral_credits() from public, anon;
grant execute on function public.parked_referral_credits() to authenticated, service_role;

-- Whether a charge of this Stripe customer (or, with null, of anyone) could have earned a 20% reward
-- that a refund or dispute would take back, so other charges are passed over without asking Stripe.
create or replace function public.referral_takeback_possible(p_customer text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.referrals r
    left join public.stripe_customers c on c.user_id = r.referred_id
    where r.reward_rule = 'percent_20' and r.rewarded_at is not null and r.first_invoice_id is not null
      and (p_customer is null or c.customer_id = p_customer)
  );
$$;
revoke execute on function public.referral_takeback_possible(text) from public, anon, authenticated;
grant execute on function public.referral_takeback_possible(text) to service_role;

-- A decided reward is no longer handed back (that let a retry credit a side twice). Kept for an old
-- stripe-webhook still running, but it now does nothing to a 'percent_20' referral or one with any credit
-- recorded.
create or replace function public.release_referral_reward(p_referral uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.referrals
  set rewarded_at = null, friend_credit_cents = null, referrer_credit_cents = null, referrer_skipped = null
  where id = p_referral and reward_rule = 'free_month' and friend_credit_id is null and referrer_credit_id is null;
$$;
revoke execute on function public.release_referral_reward(uuid) from public, anon, authenticated;
grant execute on function public.release_referral_reward(uuid) to service_role;

-- How the caller's invitations have gone (see 6843); credit_state says where their one 20% credit is:
-- 'added' once its Stripe transaction is recorded, 'parked' while set aside for review, 'adding' before.
drop function if exists public.my_referrals();
create function public.my_referrals()
returns table (signed_up integer, rewarded integer, months_earned integer, credit_cents integer, waiting integer,
               has_paid_plan boolean, credit_taken_back boolean, credit_state text)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (select * from public.referrals r where r.referrer_id = (select auth.uid()) and public.second_step_done()),
  credit as (
    select x.referrer_credit_cents as cents,
           -- After a won dispute it's on the account again only once the give-back is recorded too.
           case when x.referrer_credit_id is not null and (x.reversal_count = 0 or x.referrer_recredit_id is not null) then 'added'
                when x.referrer_needs_review then 'parked' else 'adding' end as state
    from mine x
    where x.reward_rule = 'percent_20' and x.referrer_credit_cents is not null and x.reversed_at is null
    limit 1
  )
  select (select count(*) from mine)::integer,
         (select count(*) from mine where rewarded_at is not null)::integer,
         (select count(*) from mine where reward_rule = 'free_month' and referrer_credit_cents is not null)::integer,
         (select cents from credit),
         (select count(*) from mine where rewarded_at is null)::integer,
         exists (select 1 from public.subscriptions s
                 where s.user_id = (select auth.uid()) and s.status in ('active', 'past_due', 'paused') and not s.complimentary),
         exists (select 1 from mine where reward_rule = 'percent_20' and referrer_credit_cents is not null and reversed_at is not null),
         (select state from credit);
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated, service_role;

-- The invited member's own invitation: which offer, whether it's decided, their credit, and where it is
-- ('added' once recorded at Stripe, 'adding' before, 'parked' while set aside, 'taken_back' after a full
-- refund or dispute). Nothing about who invited them.
create or replace function public.my_invitation()
returns table (reward_rule text, rewarded boolean, credit_cents integer, credit_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.reward_rule, r.rewarded_at is not null, r.friend_credit_cents,
         case
           when r.friend_credit_cents is null then null
           when r.reversed_at is not null then 'taken_back'
           when r.friend_credit_id is not null and (r.reversal_count = 0 or r.friend_recredit_id is not null) then 'added'
           when r.friend_needs_review then 'parked'
           else 'adding'
         end
  from public.referrals r
  where r.referred_id = (select auth.uid()) and public.second_step_done();
$$;
revoke execute on function public.my_invitation() from public, anon;
grant execute on function public.my_invitation() to authenticated, service_role;
