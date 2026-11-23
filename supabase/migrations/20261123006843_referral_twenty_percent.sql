-- Refer a friend, from free months to 20% (owner's decision, 2026-11-23). When a friend joins with a
-- member's link and makes their first payment, each of them gets 20% off one month of their own plan
-- as a credit on their Stripe balance: the friend once (one referral per invited account, as before),
-- and the member who invited them once per account, however many friends join. No more 2-month cap.
-- src/lib/referrals.ts holds the same rules (referralCreditCents(), referralReward()).
--
-- How much: 20% of the plan's monthly price on monthly billing; on yearly billing, 20% of a twelfth
-- of the yearly price (one month's share of what the member pays). Rounded half up to the cent, in the
-- plan's currency. Basic $6.00 / $5.00 yearly, Standard $8.00 / $6.67, Premium $12.00 / $10.00.
--
-- The cut-over is in the data: referrals.reward_rule. A referral whose reward was already claimed when
-- this runs (the friend joined and paid) keeps 'free_month', and so does everything claimed for it,
-- including a claim handed back by a failed Stripe call and claimed again. Every other referral, and
-- every new one, is 'percent_20'. The inviter's earlier free months stay and don't use up their 20%.
--
-- Deploy stripe-webhook before applying this: it reads reward_rule and currency from
-- claim_referral_reward() and treats their absence (the old function) as a free month in USD.

alter table public.referrals
  add column reward_rule text not null default 'percent_20' check (reward_rule in ('free_month', 'percent_20'));

update public.referrals set reward_rule = 'free_month' where rewarded_at is not null;

comment on column public.referrals.reward_rule is
  'Which offer this invitation follows: free_month (rewarded before 2026-11-23''s change: a month of each plan, up to 2 for the inviter) or percent_20 (20% off one month each, once per account for the inviter).';

-- 'already_credited': the inviter has had their one 20% credit.
alter table public.referrals drop constraint referrals_referrer_skipped_check;
alter table public.referrals add constraint referrals_referrer_skipped_check
  check (referrer_skipped is null or referrer_skipped in ('staff', 'no_membership', 'limit_reached', 'already_credited'));

-- An invited member reads their own row's rule, to say which offer they joined under.
grant select (reward_rule) on public.referrals to authenticated;

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

-- The return type changes (the rule and the currency are added), so it's dropped and made again.
drop function public.claim_referral_reward(uuid);

-- For stripe-webhook, when an invited member's first payment goes through: claims their referral
-- once and says what to credit under its rule (null where there's nothing to give).
create function public.claim_referral_reward(p_referred uuid)
returns table (referral_id uuid, friend_customer text, friend_cents integer, referrer_customer text, referrer_cents integer, reward_rule text, currency text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.referrals;
  v_friend   integer;
  v_cust     text;
  v_currency text;
  v_rcust    text;
  v_rcents   integer;
  v_skip     text;
begin
  select * into r from public.referrals x where x.referred_id = p_referred and x.rewarded_at is null for update;
  if r.id is null then
    return;
  end if;
  -- Staff are never billed, so a staff member who was invited isn't rewarded either.
  if exists (select 1 from public.staff_roles s where s.user_id = p_referred) then
    update public.referrals set rewarded_at = now(), referrer_skipped = 'staff' where id = r.id;
    return;
  end if;
  select private.referral_side_cents(r.reward_rule, p.price_cents, p.yearly_price_cents, s.billing_interval), c.customer_id, lower(p.currency)
    into v_friend, v_cust, v_currency
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
                where x.referrer_id = r.referrer_id and x.reward_rule = 'percent_20' and x.referrer_credit_cents is not null) then
    -- 20% once per account for inviting.
    v_skip := 'already_credited';
  else
    select private.referral_side_cents(r.reward_rule, p.price_cents, p.yearly_price_cents, s.billing_interval), c.customer_id
      into v_rcents, v_rcust
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    join public.stripe_customers c on c.user_id = s.user_id
    where s.user_id = r.referrer_id and s.status in ('active', 'past_due', 'paused') and not s.complimentary;
    if v_rcents is null then v_skip := 'no_membership'; end if;
  end if;
  update public.referrals
  set rewarded_at = now(), friend_credit_cents = v_friend,
      referrer_credit_cents = case when v_skip is null then v_rcents end, referrer_skipped = v_skip
  where id = r.id;
  return query select r.id, v_cust, v_friend, case when v_skip is null then v_rcust end, case when v_skip is null then v_rcents end,
    r.reward_rule, coalesce(v_currency, 'usd');
end;
$$;
revoke execute on function public.claim_referral_reward(uuid) from public, anon, authenticated;
grant execute on function public.claim_referral_reward(uuid) to service_role;

-- The return type changes, so it's dropped and made again (the app reads only the columns it knows).
drop function public.my_referrals();

-- How the caller's invitations have gone: friends who signed up, how many have paid, the free months
-- earned under the old offer, and their one 20% credit (null until it's added).
create function public.my_referrals()
returns table (signed_up integer, rewarded integer, months_earned integer, credit_cents integer, waiting integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where r.rewarded_at is not null)::integer,
         count(*) filter (where r.reward_rule = 'free_month' and r.referrer_credit_cents is not null)::integer,
         max(r.referrer_credit_cents) filter (where r.reward_rule = 'percent_20'),
         count(*) filter (where r.rewarded_at is null)::integer
  from public.referrals r
  where r.referrer_id = (select auth.uid()) and public.second_step_done();
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated, service_role;
