-- Refer a friend: a member shares a link with their own code; a friend who signs up with it and
-- makes their first payment gets a month of their plan free, and so does the member who invited
-- them. The month is a credit on each Stripe customer's balance (taken off the next invoices), added
-- once by stripe-webhook. Staff are never billed, so they're never rewarded. A member earns at most
-- 2 free months in all from inviting friends (REFERRAL_MONTHS_MAX in src/lib/referrals.ts); their
-- friends still get theirs after that.
--
-- * referral_codes: one per account, made by my_referral_code(). Read by its owner.
-- * referrals: who invited whom (one per invited account), written only by the sign-up trigger
--   below and the reward functions. The inviter sees counts through my_referrals(); the invited
--   member sees their own row. Stripe's balance transaction ids stay server-side.
-- Indexes for the foreign keys are in migration 6658.

create table public.referral_codes (
  account_id uuid primary key references auth.users (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

create table public.referrals (
  id                      uuid primary key default gen_random_uuid(),
  referrer_id             uuid not null references auth.users (id) on delete cascade,
  referred_id             uuid not null unique references auth.users (id) on delete cascade,
  created_at              timestamptz not null default now(),
  -- Set by claim_referral_reward() when the invited member's first payment goes through.
  rewarded_at             timestamptz,
  friend_credit_cents     integer check (friend_credit_cents is null or friend_credit_cents > 0),
  referrer_credit_cents   integer check (referrer_credit_cents is null or referrer_credit_cents > 0),
  -- Why the inviter got nothing for this one (staff, no membership, or their 2 months already earned).
  referrer_skipped        text check (referrer_skipped is null or referrer_skipped in ('staff', 'no_membership', 'limit_reached')),
  friend_credit_id        text check (friend_credit_id is null or friend_credit_id ~ '^cbtxn_[A-Za-z0-9]+$'),
  referrer_credit_id      text check (referrer_credit_id is null or referrer_credit_id ~ '^cbtxn_[A-Za-z0-9]+$'),
  check (referrer_id <> referred_id)
);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

create policy "Owners read their referral code" on public.referral_codes for select to authenticated
  using (account_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.referral_codes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

create policy "Invited members read their own referral" on public.referrals for select to authenticated
  using (referred_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.referrals as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.referral_codes, public.referrals from anon, authenticated;
grant select (account_id, code, created_at) on public.referral_codes to authenticated;
grant select (id, referred_id, created_at, rewarded_at, friend_credit_cents) on public.referrals to authenticated;
grant select, insert, update, delete on public.referral_codes, public.referrals to service_role;

-- The caller's referral code, made the first time it's asked for. Staff have none (they're never billed).
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_code text;
  v_try  integer := 0;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to invite a friend' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.staff_roles s where s.user_id = v_user) then
    raise exception 'Staff memberships are complimentary, so there''s nothing to reward' using errcode = 'insufficient_privilege';
  end if;
  select c.code into v_code from public.referral_codes c where c.account_id = v_user;
  while v_code is null loop
    v_try := v_try + 1;
    v_code := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '')
      from generate_series(1, 8)
    );
    begin
      insert into public.referral_codes (account_id, code) values (v_user, v_code);
    exception when unique_violation then
      -- Another tab made this account's code a moment ago, or the code is taken: look again.
      select c.code into v_code from public.referral_codes c where c.account_id = v_user;
      if v_try > 5 then raise; end if;
    end;
  end loop;
  return v_code;
end;
$$;
revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated, service_role;

-- How the caller's invitations have gone: friends who signed up, and the months they've earned.
create or replace function public.my_referrals()
returns table (signed_up integer, rewarded integer, months_earned integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where r.rewarded_at is not null)::integer,
         count(*) filter (where r.referrer_credit_cents is not null)::integer
  from public.referrals r
  where r.referrer_id = (select auth.uid()) and public.second_step_done();
$$;
revoke execute on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated, service_role;

-- A new account that signed up with a code (raw_user_meta_data.referral_code) is noted as invited.
-- Never stops a sign-up: a code that doesn't match anything is simply ignored.
create or replace function private.record_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code     text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  v_referrer uuid;
begin
  if v_code !~ '^[A-HJ-NP-Z2-9]{8}$' then
    return new;
  end if;
  select c.account_id into v_referrer from public.referral_codes c where c.code = v_code;
  if v_referrer is not null and v_referrer <> new.id then
    insert into public.referrals (referrer_id, referred_id) values (v_referrer, new.id) on conflict (referred_id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'record_referral: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function private.record_referral() from public, anon, authenticated;

create trigger record_referral
  after insert on auth.users
  for each row execute function private.record_referral();

-- For stripe-webhook, when an invited member's first payment goes through: claims their referral
-- once and says what to credit, a month of each member's own plan (null where there's nothing to give).
create or replace function public.claim_referral_reward(p_referred uuid)
returns table (referral_id uuid, friend_customer text, friend_cents integer, referrer_customer text, referrer_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.referrals;
  v_friend   integer;
  v_cust     text;
  v_rcust    text;
  v_rcents   integer;
  v_skip     text;
begin
  select * into r from public.referrals where referred_id = p_referred and rewarded_at is null for update;
  if r.id is null then
    return;
  end if;
  -- Staff are never billed, so a staff member who was invited isn't rewarded either.
  if exists (select 1 from public.staff_roles s where s.user_id = p_referred) then
    update public.referrals set rewarded_at = now(), referrer_skipped = 'staff' where id = r.id;
    return;
  end if;
  select p.price_cents, c.customer_id into v_friend, v_cust
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  join public.stripe_customers c on c.user_id = s.user_id
  where s.user_id = p_referred;
  if v_friend is null then
    -- No paid membership to credit yet: wait for the next payment.
    return;
  end if;
  -- Two friends paying at once are counted one after the other, so the 2-month limit holds.
  perform pg_advisory_xact_lock(hashtextextended('referral-reward:' || r.referrer_id::text, 0));
  if exists (select 1 from public.staff_roles s where s.user_id = r.referrer_id) then
    v_skip := 'staff';
  elsif (select count(*) from public.referrals x where x.referrer_id = r.referrer_id and x.referrer_credit_cents is not null) >= 2 then
    -- 2 free months in all from inviting friends.
    v_skip := 'limit_reached';
  else
    select p.price_cents, c.customer_id into v_rcents, v_rcust
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    join public.stripe_customers c on c.user_id = s.user_id
    where s.user_id = r.referrer_id and s.status in ('active', 'past_due', 'paused') and not s.complimentary;
    if v_rcents is null then v_skip := 'no_membership'; end if;
  end if;
  update public.referrals
  set rewarded_at = now(), friend_credit_cents = v_friend,
      referrer_credit_cents = case when v_skip is null then v_rcents end, referrer_skipped = v_skip
  where id = r.id;
  return query select r.id, v_cust, v_friend, case when v_skip is null then v_rcust end, case when v_skip is null then v_rcents end;
end;
$$;
revoke execute on function public.claim_referral_reward(uuid) from public, anon, authenticated;
grant execute on function public.claim_referral_reward(uuid) to service_role;

-- If crediting Stripe failed, the claim is handed back so Stripe's retry of the event tries again
-- (the credits use idempotency keys, so one that did go through isn't added twice).
create or replace function public.release_referral_reward(p_referral uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.referrals
  set rewarded_at = null, friend_credit_cents = null, referrer_credit_cents = null, referrer_skipped = null
  where id = p_referral;
$$;
revoke execute on function public.release_referral_reward(uuid) from public, anon, authenticated;
grant execute on function public.release_referral_reward(uuid) to service_role;

-- The credits Stripe made, kept for support (never sent to the browser).
create or replace function public.record_referral_credits(p_referral uuid, p_friend text, p_referrer text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.referrals set friend_credit_id = p_friend, referrer_credit_id = p_referrer where id = p_referral;
$$;
revoke execute on function public.record_referral_credits(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_referral_credits(uuid, text, text) to service_role;
