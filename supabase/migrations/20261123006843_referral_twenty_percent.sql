-- Refer a friend, from free months to 20% (owner's decisions, 2026-11-23). When a friend joins with a
-- member's link and makes their first payment, each of them gets 20% off one month of their own plan
-- as a credit on their Stripe balance: the friend once (one referral per invited account, as before),
-- and the member who invited them once per account, however many friends join and whatever free months
-- they earned before. No more 2-month cap. If that first payment is fully refunded, or disputed, both
-- 20% credits are taken back (a positive balance, owed on the next bill if already used); if a dispute
-- is then closed in our favour, they're added again. Free months from the old offer are never taken back.
-- src/lib/referrals.ts holds the same rules.
--
-- How much: 20% of the plan's monthly price on monthly billing; on yearly billing, 20% of a twelfth
-- of the yearly price (one month's share of what the member pays). Rounded half up to the cent, in each
-- member's own plan currency. Basic $6.00 / $5.00 yearly, Standard $8.00 / $6.67, Premium $12.00 / $10.00.
--
-- The cut-over is in the data: referrals.reward_rule, set when this runs. A referral keeps 'free_month'
-- (a month of each plan, up to 2 for the inviter) when, at that moment, its reward was claimed
-- (rewarded_at), or any credit for it is recorded, or the friend had already paid anything
-- (account_private.card_payment_at: so a claim handed back by a failed Stripe call, or a payment that
-- came in before the membership row, still counts as earned). Every other referral, and every new one,
-- is 'percent_20'. Running this file again only moves referrals to 'free_month' by the same test.
--
-- Each side's Stripe balance transaction is recorded as soon as it's made (record_referral_transaction()),
-- and a decided reward is never handed back: a retry, or the friend's next paid invoice, only makes the
-- transactions still missing (private.referral_pending()). stripe-webhook also looks for a transaction it
-- already made (its key is in the metadata) before making one, so an expired Stripe idempotency key can't
-- credit twice.
--
-- Deploy stripe-webhook before applying this: it falls back to the old functions while these are missing.

alter table public.referrals
  add column if not exists reward_rule text not null default 'percent_20' check (reward_rule in ('free_month', 'percent_20')),
  -- Each side's credit currency (its own plan's), set with the amounts.
  add column if not exists friend_currency text check (friend_currency is null or friend_currency ~ '^[a-z]{3}$'),
  add column if not exists referrer_currency text check (referrer_currency is null or referrer_currency ~ '^[a-z]{3}$'),
  -- The invoice whose payment earned the reward: a full refund or a dispute of it takes the credits back.
  add column if not exists first_invoice_id text check (first_invoice_id is null or first_invoice_id ~ '^in_[A-Za-z0-9]+$'),
  -- Set while the credits are taken back (a refund, or an open or lost dispute); cleared when a dispute is won.
  add column if not exists reversed_at timestamptz,
  -- Rounds of taking back, so each round's Stripe transactions have their own keys.
  add column if not exists reversal_count smallint not null default 0 check (reversal_count >= 0),
  add column if not exists friend_reversal_id text check (friend_reversal_id is null or friend_reversal_id ~ '^cbtxn_[A-Za-z0-9]+$'),
  add column if not exists referrer_reversal_id text check (referrer_reversal_id is null or referrer_reversal_id ~ '^cbtxn_[A-Za-z0-9]+$'),
  add column if not exists friend_recredit_id text check (friend_recredit_id is null or friend_recredit_id ~ '^cbtxn_[A-Za-z0-9]+$'),
  add column if not exists referrer_recredit_id text check (referrer_recredit_id is null or referrer_recredit_id ~ '^cbtxn_[A-Za-z0-9]+$');

-- The cut-over (see above), as a function so the security tests run the very same test; it says how
-- many referrals it kept on the free month.
create or replace function private.referral_cutover()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_kept integer;
begin
  update public.referrals r
  set reward_rule = 'free_month'
  where r.reward_rule <> 'free_month'
    and (r.rewarded_at is not null
         or r.friend_credit_id is not null
         or r.referrer_credit_id is not null
         or exists (select 1 from public.account_private a where a.user_id = r.referred_id and a.card_payment_at is not null));
  get diagnostics v_kept = row_count;
  return v_kept;
end;
$$;
revoke execute on function private.referral_cutover() from public, anon, authenticated;

select private.referral_cutover();

comment on column public.referrals.reward_rule is
  'Which offer this invitation follows: free_month (earned before 2026-11-23''s change: a month of each plan, up to 2 for the inviter, never taken back) or percent_20 (20% off one month each, once per account for the inviter; taken back if the first payment is refunded or disputed).';

-- 'already_credited': the inviter has had their one 20% credit.
alter table public.referrals drop constraint if exists referrals_referrer_skipped_check;
alter table public.referrals add constraint referrals_referrer_skipped_check
  check (referrer_skipped is null or referrer_skipped in ('staff', 'no_membership', 'limit_reached', 'already_credited'));

-- An invited member reads their own row's rule and whether it was taken back, to say where it stands.
grant select (reward_rule, reversed_at) on public.referrals to authenticated;

-- 20% of one month of a plan, in cents, rounded half up: (2n + d) / (2d) in whole numbers, so it
-- never depends on floating point. Monthly: n = the monthly price, d = 5. Yearly: n = the yearly
-- price, d = 60 (a twelfth, then a fifth). Null when there's no price to take it from, or it rounds to 0.
create or replace function private.referral_credit_cents(p_monthly integer, p_yearly integer, p_interval text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select nullif(case
    when p_interval = 'year' and coalesce(p_yearly, 0) > 0 then (2 * p_yearly + 60) / 120
    when coalesce(p_monthly, 0) > 0 then (2 * p_monthly + 5) / 10
  end, 0);
$$;
revoke execute on function private.referral_credit_cents(integer, integer, text) from public, anon, authenticated;

-- What one referral's side is worth under its rule: a free month is the monthly price, as before.
create or replace function private.referral_side_cents(p_rule text, p_monthly integer, p_yearly integer, p_interval text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_rule
    when 'free_month' then case when coalesce(p_monthly, 0) > 0 then p_monthly end
    else private.referral_credit_cents(p_monthly, p_yearly, p_interval)
  end;
$$;
revoke execute on function private.referral_side_cents(text, integer, integer, text) from public, anon, authenticated;

-- The Stripe balance transactions a decided referral still needs, from its recorded state: one row per
-- side and kind. 'credit' (the reward, a negative balance), 'reversal' (taking it back in round n, a
-- positive balance) or 'recredit' (the reward again after a won dispute, round n). A side is never owed
-- a transaction it already has, and a free month is never taken back.
create or replace function private.referral_pending(p_referral uuid)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text)
language sql
stable
set search_path = ''
as $$
  with r as (select * from public.referrals x where x.id = p_referral and x.rewarded_at is not null),
  sides as (
    select r.id, 'friend'::text as side, r.referred_id as user_id, r.friend_credit_cents as cents, r.friend_currency as currency,
           r.friend_credit_id as credit_id, r.friend_reversal_id as reversal_id, r.friend_recredit_id as recredit_id,
           r.reversed_at, r.reversal_count, r.reward_rule
    from r
    union all
    select r.id, 'referrer', r.referrer_id, r.referrer_credit_cents, r.referrer_currency,
           r.referrer_credit_id, r.referrer_reversal_id, r.referrer_recredit_id, r.reversed_at, r.reversal_count, r.reward_rule
    from r
  ),
  owed as (
    select s.*,
           case
             when s.reversed_at is null and s.credit_id is null then 'credit'
             when s.reward_rule = 'percent_20' and s.reversed_at is not null and s.credit_id is not null and s.reversal_id is null then 'reversal'
             when s.reward_rule = 'percent_20' and s.reversed_at is null and s.reversal_count > 0
                  and s.reversal_id is not null and s.recredit_id is null then 'recredit'
           end as kind
    from sides s
    where s.cents is not null
  )
  select o.id, o.side, o.kind, o.reversal_count::integer, c.customer_id, o.cents, coalesce(o.currency, 'usd'), o.reward_rule
  from owed o
  join public.stripe_customers c on c.user_id = o.user_id
  where o.kind is not null
  order by o.side;
$$;
revoke execute on function private.referral_pending(uuid) from public, anon, authenticated;

-- The return type and arguments change, so the old ones are dropped.
drop function if exists public.claim_referral_reward(uuid);
drop function if exists public.claim_referral_reward(uuid, text);

-- For stripe-webhook, when an invited member's payment goes through: decides their referral's reward
-- once (on the first payment; p_invoice is its invoice), then says which Stripe transactions it still
-- needs. Called again on a retry or a later paid invoice, it only gives what's still missing.
create function public.claim_referral_reward(p_referred uuid, p_invoice text default null)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text)
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
  return query select * from private.referral_pending(r.id) q where q.kind in ('credit', 'recredit');
end;
$$;
revoke execute on function public.claim_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_referral_reward(uuid, text) to service_role;

-- For stripe-webhook, when the invoice that earned a 20% reward is fully refunded or disputed: takes
-- both credits back (once per round; a side not credited yet is then never credited), and says which
-- reversals Stripe still needs. Never a free month, and nothing for any other invoice.
create or replace function public.reverse_referral_reward(p_referred uuid, p_invoice text)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text)
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
    update public.referrals
    set reversed_at = now(), reversal_count = reversal_count + 1, friend_reversal_id = null, referrer_reversal_id = null
    where id = r.id;
  end if;
  return query select * from private.referral_pending(r.id) q where q.kind = 'reversal';
end;
$$;
revoke execute on function public.reverse_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.reverse_referral_reward(uuid, text) to service_role;

-- For stripe-webhook, when a dispute of that invoice is closed in our favour: the credits come back
-- (a side that was never credited is credited now).
create or replace function public.restore_referral_reward(p_referred uuid, p_invoice text)
returns table (referral_id uuid, side text, kind text, round integer, customer text, cents integer, currency text, reward_rule text)
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
    update public.referrals set reversed_at = null, friend_recredit_id = null, referrer_recredit_id = null where id = r.id;
  end if;
  return query select * from private.referral_pending(r.id) q where q.kind in ('credit', 'recredit');
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
  if p_kind = 'credit' and p_side = 'friend' then
    update public.referrals set friend_credit_id = p_txn where id = p_referral and friend_credit_id is null;
  elsif p_kind = 'credit' then
    update public.referrals set referrer_credit_id = p_txn where id = p_referral and referrer_credit_id is null;
  elsif p_kind = 'reversal' and p_side = 'friend' then
    update public.referrals set friend_reversal_id = p_txn where id = p_referral and reversal_count = p_round and friend_reversal_id is null;
  elsif p_kind = 'reversal' then
    update public.referrals set referrer_reversal_id = p_txn where id = p_referral and reversal_count = p_round and referrer_reversal_id is null;
  elsif p_side = 'friend' then
    update public.referrals set friend_recredit_id = p_txn where id = p_referral and reversal_count = p_round and friend_recredit_id is null;
  else
    update public.referrals set referrer_recredit_id = p_txn where id = p_referral and reversal_count = p_round and referrer_recredit_id is null;
  end if;
  get diagnostics v_done = row_count;
  return v_done > 0;
end;
$$;
revoke execute on function public.record_referral_transaction(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_referral_transaction(uuid, text, text, integer, text) to service_role;

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

-- The return type changes, so it's dropped and made again (the app reads only the columns it knows).
drop function if exists public.my_referrals();

-- How the caller's invitations have gone: friends who signed up, how many have paid, the free months
-- earned under the old offer, their one 20% credit (null until it's decided, or while it's taken back),
-- friends still to pay, and whether the caller has a paid plan now (the 20% needs one when a friend pays).
create function public.my_referrals()
returns table (signed_up integer, rewarded integer, months_earned integer, credit_cents integer, waiting integer, has_paid_plan boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where r.rewarded_at is not null)::integer,
         count(*) filter (where r.reward_rule = 'free_month' and r.referrer_credit_cents is not null)::integer,
         max(r.referrer_credit_cents) filter (where r.reward_rule = 'percent_20' and r.reversed_at is null),
         count(*) filter (where r.rewarded_at is null)::integer,
         exists (select 1 from public.subscriptions s
                 where s.user_id = (select auth.uid()) and s.status in ('active', 'past_due', 'paused') and not s.complimentary)
  from public.referrals r
  where r.referrer_id = (select auth.uid()) and public.second_step_done();
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated, service_role;
