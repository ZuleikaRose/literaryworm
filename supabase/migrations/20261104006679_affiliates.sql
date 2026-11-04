-- The affiliate program (stories 82–84). An adult member applies with their website and how they'll
-- promote LiteraryWorm, agreeing to the program terms, to disclose that they earn a commission (FTC
-- Endorsement Guides) and never to market to children. Sales staff or an admin approve or decline;
-- an approved affiliate gets a code for a sign-up link. When someone who signed up with it makes
-- their first payment, the affiliate earns 20% of that payment as a credit on their own Stripe
-- balance (taken off their next invoices), added once by stripe-webhook. No cash payouts. Staff are
-- never billed, so they can't be affiliates.
--
-- * affiliates: one per account; applied for through apply_affiliate(), decided through
--   review_affiliate(). Read by its owner; sales staff and admins read every application through
--   affiliate_applications(), which returns no email address.
-- * affiliate_clicks: link visits per affiliate per day, counted by the affiliate-click function
--   (at most one per visitor's IP, affiliate and day; the IP is never stored).
-- * affiliate_referrals: who signed up with which code, written only by the sign-up trigger and the
--   reward functions. Affiliates see counts through my_affiliate(); Stripe ids stay server-side.
-- Indexes for the foreign keys are in migrations 6680 and 6681.

create table public.affiliates (
  account_id        uuid primary key references auth.users (id) on delete cascade,
  status            text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'suspended')),
  website           text not null check (website ~ '^https://[^\s]{4,300}$'),
  channels          text not null check (char_length(btrim(channels)) between 10 and 500),
  terms_accepted_at timestamptz not null default now(),
  -- Both agreements are required to apply (story 84).
  discloses_commission boolean not null check (discloses_commission),
  no_marketing_to_children boolean not null check (no_marketing_to_children),
  code              text unique check (code is null or code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  applied_at        timestamptz not null default now(),
  decided_at        timestamptz,
  decided_by        uuid references auth.users (id) on delete set null,
  check ((status = 'approved') = (code is not null) or status = 'suspended')
);

create table public.affiliate_clicks (
  affiliate_id uuid not null references public.affiliates (account_id) on delete cascade,
  day          date not null,
  clicks       integer not null default 0 check (clicks >= 0),
  primary key (affiliate_id, day)
);

create table public.affiliate_referrals (
  id               uuid primary key default gen_random_uuid(),
  affiliate_id     uuid not null references public.affiliates (account_id) on delete cascade,
  referred_id      uuid not null unique references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  -- Set by claim_affiliate_commission() when the referred member's first payment goes through.
  rewarded_at      timestamptz,
  first_payment_cents integer check (first_payment_cents is null or first_payment_cents > 0),
  commission_cents integer check (commission_cents is null or commission_cents > 0),
  -- Why the affiliate got nothing for this one.
  skipped          text check (skipped is null or skipped in ('staff', 'no_membership', 'not_approved')),
  credit_id        text check (credit_id is null or credit_id ~ '^cbtxn_[A-Za-z0-9]+$'),
  check (affiliate_id <> referred_id)
);

alter table public.affiliates enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_referrals enable row level security;

create policy "Affiliates read their own application" on public.affiliates for select to authenticated
  using (account_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.affiliates as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "No browser access to affiliate clicks" on public.affiliate_clicks as restrictive for all to anon, authenticated
  using (false) with check (false);
create policy "No browser access to affiliate referrals" on public.affiliate_referrals as restrictive for all to anon, authenticated
  using (false) with check (false);

revoke all on public.affiliates, public.affiliate_clicks, public.affiliate_referrals from anon, authenticated;
grant select (account_id, status, website, channels, terms_accepted_at, code, applied_at, decided_at) on public.affiliates to authenticated;
grant select, insert, update, delete on public.affiliates, public.affiliate_clicks, public.affiliate_referrals to service_role;

-- Apply (or apply again after a decline) as the signed-in member. Staff can't: they're never billed.
create or replace function public.apply_affiliate(p_website text, p_channels text, p_discloses boolean, p_no_children boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_status text;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to apply' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.staff_roles s where s.user_id = v_user) then
    raise exception 'Staff memberships are complimentary, so there''s no credit to earn' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(p_discloses, false) or not coalesce(p_no_children, false) then
    raise exception 'Agree to disclose the commission and not to market to children' using errcode = 'check_violation';
  end if;
  select a.status into v_status from public.affiliates a where a.account_id = v_user;
  if v_status in ('pending', 'approved', 'suspended') then
    raise exception 'You''ve already applied' using errcode = 'unique_violation';
  end if;
  insert into public.affiliates (account_id, website, channels, discloses_commission, no_marketing_to_children)
  values (v_user, btrim(p_website), btrim(p_channels), true, true)
  on conflict (account_id) do update
    set status = 'pending', website = excluded.website, channels = excluded.channels, terms_accepted_at = now(),
        discloses_commission = true, no_marketing_to_children = true, code = null, applied_at = now(), decided_at = null, decided_by = null;
  return 'pending';
end;
$$;
revoke execute on function public.apply_affiliate(text, text, boolean, boolean) from public, anon;
grant execute on function public.apply_affiliate(text, text, boolean, boolean) to authenticated, service_role;

-- How the caller's affiliate link is doing: counts only, never who.
create or replace function public.my_affiliate()
returns table (clicks_30_days integer, clicks_total integer, signed_up integer, paid integer, earned_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select sum(c.clicks) from public.affiliate_clicks c where c.affiliate_id = (select auth.uid()) and c.day > current_date - 30), 0)::integer,
    coalesce((select sum(c.clicks) from public.affiliate_clicks c where c.affiliate_id = (select auth.uid())), 0)::integer,
    (select count(*) from public.affiliate_referrals r where r.affiliate_id = (select auth.uid()))::integer,
    (select count(*) from public.affiliate_referrals r where r.affiliate_id = (select auth.uid()) and r.commission_cents is not null)::integer,
    coalesce((select sum(r.commission_cents) from public.affiliate_referrals r where r.affiliate_id = (select auth.uid())), 0)::integer
  where public.second_step_done();
$$;
revoke execute on function public.my_affiliate() from public, anon;
grant execute on function public.my_affiliate() to authenticated, service_role;

-- Applications for sales staff and admins: the website, channels and dates, and the member's display
-- name (never an email address). Pending first.
create or replace function public.affiliate_applications()
returns table (account_id uuid, display_name text, status text, website text, channels text, applied_at timestamptz, decided_at timestamptz, code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('sales') or not public.second_step_done() then
    raise exception 'Only sales staff and admins review affiliates' using errcode = 'insufficient_privilege';
  end if;
  return query
    select a.account_id, p.display_name, a.status, a.website, a.channels, a.applied_at, a.decided_at, a.code
    from public.affiliates a left join public.profiles p on p.id = a.account_id
    order by (a.status = 'pending') desc, a.applied_at desc
    limit 500;
end;
$$;
revoke execute on function public.affiliate_applications() from public, anon;
grant execute on function public.affiliate_applications() to authenticated, service_role;

-- Approve (making a code), decline, or suspend an affiliate. Sales staff and admins only.
create or replace function public.review_affiliate(p_account uuid, p_decision text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_try  integer := 0;
begin
  if not public.has_staff_role('sales') or not public.second_step_done() then
    raise exception 'Only sales staff and admins review affiliates' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('approved', 'declined', 'suspended') then
    raise exception 'Choose approve, decline or suspend' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.affiliates a where a.account_id = p_account) then
    raise exception 'No such application' using errcode = 'no_data_found';
  end if;
  if p_decision = 'approved' then
    select a.code into v_code from public.affiliates a where a.account_id = p_account;
    while v_code is null loop
      v_try := v_try + 1;
      v_code := (
        select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::integer, 1), '')
        from generate_series(1, 10)
      );
      if exists (select 1 from public.affiliates a where a.code = v_code) then
        v_code := null;
        if v_try > 5 then raise exception 'Couldn''t make a code; try again'; end if;
      end if;
    end loop;
    update public.affiliates set status = 'approved', code = v_code, decided_at = now(), decided_by = (select auth.uid()) where account_id = p_account;
  elsif p_decision = 'declined' then
    update public.affiliates set status = 'declined', code = null, decided_at = now(), decided_by = (select auth.uid()) where account_id = p_account;
  else
    -- Suspended: the code stops counting new sign-ups and earning; it's kept so the history stays readable.
    update public.affiliates set status = 'suspended', decided_at = now(), decided_by = (select auth.uid()) where account_id = p_account;
  end if;
  return p_decision;
end;
$$;
revoke execute on function public.review_affiliate(uuid, text) from public, anon;
grant execute on function public.review_affiliate(uuid, text) to authenticated, service_role;

-- A visit to an approved affiliate's link, from the affiliate-click function (which allows one per
-- visitor's IP, code and day, and never passes the IP on). Unknown or unapproved codes are ignored.
create or replace function public.record_affiliate_click(p_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.affiliate_clicks (affiliate_id, day, clicks)
  select a.account_id, current_date, 1 from public.affiliates a where a.code = upper(btrim(p_code)) and a.status = 'approved'
  on conflict (affiliate_id, day) do update set clicks = public.affiliate_clicks.clicks + 1;
$$;
revoke execute on function public.record_affiliate_click(text) from public, anon, authenticated;
grant execute on function public.record_affiliate_click(text) to service_role;

-- A new account that signed up with an approved affiliate's code (raw_user_meta_data.affiliate_code)
-- is noted. Never stops a sign-up: a code that doesn't match an approved affiliate is ignored.
create or replace function private.record_affiliate_referral()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code      text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'affiliate_code', '')));
  v_affiliate uuid;
begin
  if v_code !~ '^[A-HJ-NP-Z2-9]{10}$' then
    return new;
  end if;
  select a.account_id into v_affiliate from public.affiliates a where a.code = v_code and a.status = 'approved';
  if v_affiliate is not null and v_affiliate <> new.id then
    insert into public.affiliate_referrals (affiliate_id, referred_id) values (v_affiliate, new.id) on conflict (referred_id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'record_affiliate_referral: %', sqlerrm;
  return new;
end;
$$;
revoke execute on function private.record_affiliate_referral() from public, anon, authenticated;

create trigger record_affiliate_referral
  after insert on auth.users
  for each row execute function private.record_affiliate_referral();

-- For stripe-webhook, on a referred member's first payment: claims it once and says what to credit,
-- 20% of that payment to the affiliate's own Stripe balance (nothing when the affiliate isn't an
-- approved paying member, or the referred member is staff).
create or replace function public.claim_affiliate_commission(p_referred uuid, p_amount_cents integer)
returns table (referral_id uuid, affiliate_customer text, commission_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       public.affiliate_referrals;
  v_cust  text;
  v_skip  text;
  v_cents integer := floor(greatest(p_amount_cents, 0) * 0.20)::integer;
begin
  select * into r from public.affiliate_referrals where referred_id = p_referred and rewarded_at is null for update;
  if r.id is null or v_cents <= 0 then
    return;
  end if;
  if exists (select 1 from public.staff_roles s where s.user_id = p_referred) then
    v_skip := 'staff';
  elsif not exists (select 1 from public.affiliates a where a.account_id = r.affiliate_id and a.status = 'approved') then
    v_skip := 'not_approved';
  else
    select c.customer_id into v_cust
    from public.subscriptions s join public.stripe_customers c on c.user_id = s.user_id
    where s.user_id = r.affiliate_id and s.status in ('active', 'past_due', 'paused') and not s.complimentary;
    if v_cust is null then v_skip := 'no_membership'; end if;
  end if;
  update public.affiliate_referrals
  set rewarded_at = now(), first_payment_cents = p_amount_cents,
      commission_cents = case when v_skip is null then v_cents end, skipped = v_skip
  where id = r.id;
  if v_skip is null then
    return query select r.id, v_cust, v_cents;
  end if;
end;
$$;
revoke execute on function public.claim_affiliate_commission(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_affiliate_commission(uuid, integer) to service_role;

-- If crediting Stripe failed, the claim is handed back so Stripe's retry of the event tries again.
create or replace function public.release_affiliate_commission(p_referral uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.affiliate_referrals
  set rewarded_at = null, first_payment_cents = null, commission_cents = null, skipped = null
  where id = p_referral;
$$;
revoke execute on function public.release_affiliate_commission(uuid) from public, anon, authenticated;
grant execute on function public.release_affiliate_commission(uuid) to service_role;

create or replace function public.record_affiliate_credit(p_referral uuid, p_credit text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.affiliate_referrals set credit_id = p_credit where id = p_referral;
$$;
revoke execute on function public.record_affiliate_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.record_affiliate_credit(uuid, text) to service_role;

-- Click counts older than two years go (the totals affiliates see are kept in the referrals).
select cron.schedule('affiliate-clicks-cleanup', '25 4 * * *', $$delete from public.affiliate_clicks where day < current_date - 730$$);
