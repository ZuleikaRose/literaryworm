-- Phase 1: accounts, plans and subscriptions.
--
-- Conventions for every migration in this project:
--   * Passwords live only in Supabase Auth (auth.users). No table stores them.
--   * Every table has Row Level Security enabled. Policies call (select auth.uid())
--     so it's evaluated once per query, not once per row.
--   * Every foreign key and every column a policy filters on is indexed.
--   * Browser roles (anon, authenticated) get column-level grants for exactly
--     what the UI needs. Everything else goes through an Edge Function.
--   * SECURITY DEFINER functions live in the private schema (not exposed by the
--     API), use an empty search_path, and are not executable by browser roles.

-- -----------------------------------------------------------------------------
-- Shared setup
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- profiles: the public face of an account (the brief's required table)
-- -----------------------------------------------------------------------------

-- One row per user. Only the display name is public: it appears next to
-- reading logs. Private account details live in account_private.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Display names are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users rename only themselves"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rows are created by the sign-up trigger below, never by the browser.
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name, created_at) on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;


-- -----------------------------------------------------------------------------
-- account_private: details only the account holder can see
-- -----------------------------------------------------------------------------

create table public.account_private (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  -- Collected only to confirm the account holder is 18 or older.
  date_of_birth     date not null,
  marketing_emails  boolean not null default false,  -- opt-in, off by default
  terms_accepted_at timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger account_private_set_updated_at
  before update on public.account_private
  for each row execute function public.set_updated_at();

-- Account holders must be 18+. A trigger rather than a CHECK, because CHECK
-- constraints must be immutable and "today" is not.
create or replace function private.enforce_adult_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth > (current_date - interval '18 years') then
    raise exception 'Account holders must be 18 or older'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger account_private_enforce_adult
  before insert or update of date_of_birth on public.account_private
  for each row execute function private.enforce_adult_account();

alter table public.account_private enable row level security;

create policy "Users read their own account details"
  on public.account_private for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users change their own marketing choice"
  on public.account_private for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.account_private from anon, authenticated;
grant select (user_id, date_of_birth, marketing_emails, terms_accepted_at, created_at)
  on public.account_private to authenticated;
grant update (marketing_emails) on public.account_private to authenticated;


-- -----------------------------------------------------------------------------
-- Sign-up: validate the visitor's input and create the account rows
-- -----------------------------------------------------------------------------

-- Sign-up is anonymous input. Supabase Auth stores the form fields in
-- raw_user_meta_data; this trigger validates them and creates profiles and
-- account_private in the same transaction, so an invalid sign-up never
-- produces a user.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name     text  := btrim(coalesce(meta ->> 'display_name', ''));
  dob_text text  := coalesce(meta ->> 'date_of_birth', '');
  dob      date;
begin
  if char_length(name) not between 1 and 60 then
    raise exception 'Display name must be 1 to 60 characters' using errcode = 'check_violation';
  end if;
  if dob_text !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Date of birth must be YYYY-MM-DD' using errcode = 'check_violation';
  end if;
  dob := dob_text::date;
  if coalesce((meta ->> 'terms_accepted')::boolean, false) is not true then
    raise exception 'The Terms of Service must be accepted' using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, display_name) values (new.id, name);
  insert into public.account_private (user_id, date_of_birth, marketing_emails, terms_accepted_at)
  values (new.id, dob, coalesce((meta ->> 'marketing_emails')::boolean, false), now());
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();


-- -----------------------------------------------------------------------------
-- plans: public catalog, managed by admins
-- -----------------------------------------------------------------------------

create table public.plans (
  id               text primary key check (id in ('basic', 'standard', 'premium')),
  name             text not null,
  price_cents      integer not null check (price_cents > 0),
  currency         char(3) not null default 'USD',
  max_profiles     smallint not null check (max_profiles between 1 and 5),
  audio_hours      integer,           -- null means unlimited
  download_devices smallint not null check (download_devices >= 0),
  summary          text not null,
  sort_order       smallint not null default 0
);

alter table public.plans enable row level security;

create policy "Plans are public"
  on public.plans for select
  to anon, authenticated
  using (true);

revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;

insert into public.plans (id, name, price_cents, max_profiles, audio_hours, download_devices, summary, sort_order) values
  ('basic',    'Basic',    799,  1, 5,    1, 'Ebooks for one reader.',                       1),
  ('standard', 'Standard', 1299, 3, 30,   3, 'Reading and listening for a small household.', 2),
  ('premium',  'Premium',  1799, 5, null, 5, 'Unlimited listening for the whole family.',    3);


-- -----------------------------------------------------------------------------
-- subscriptions: written only by the checkout Edge Function
-- -----------------------------------------------------------------------------

-- Card details are never stored: Stripe holds them; we keep only Stripe's IDs.
create type public.subscription_status as enum ('active', 'paused', 'cancelled', 'past_due');

create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references auth.users (id) on delete cascade,
  plan_id                   text not null references public.plans (id),
  status                    public.subscription_status not null default 'active',
  billing_day               smallint not null check (billing_day between 1 and 28),
  renewal_terms_accepted_at timestamptz not null,   -- auto-renewal consent (ROSCA / state laws)
  current_period_end        timestamptz,
  cancel_at_period_end      boolean not null default false,
  stripe_customer_id        text,
  stripe_subscription_id    text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- user_id is indexed by its unique constraint; plan_id gets its own index in
-- the 0101 migration (CREATE INDEX CONCURRENTLY runs outside a transaction).

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "Users read their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.subscriptions from anon, authenticated;
grant select (id, user_id, plan_id, status, billing_day, renewal_terms_accepted_at,
              current_period_end, cancel_at_period_end, created_at, updated_at)
  on public.subscriptions to authenticated;
-- Stripe IDs stay server-side. Plan changes go through the checkout function.
