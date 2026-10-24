-- =============================================================================
-- BookWorm database schema (Supabase PostgreSQL)
--
-- Grows phase by phase alongside the front end in front_end/bookworm-app.
-- The front end currently keeps this data in memory; this file is the target
-- schema for the Supabase backend.
--
-- Conventions
--   * Passwords live only in Supabase Auth (auth.users). No table stores them.
--   * Every table has Row Level Security enabled. Members see only their own rows.
--   * Timestamps are timestamptz, defaulting to now().
--
-- Phases included so far:
--   Phase 1: profiles (one per signed-in user), plans, subscriptions
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- Phase 1: accounts
-- -----------------------------------------------------------------------------

-- One row per signed-in user, linked to the Supabase Auth user.
-- display_name is what other readers see (never the email address).
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null check (char_length(btrim(display_name)) between 1 and 60),
  -- Collected only to confirm the account holder is 18 or older (enforced by trigger below).
  date_of_birth     date not null,
  marketing_emails  boolean not null default false,  -- opt-in, off by default
  terms_accepted_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Account holders must be 18+. A trigger rather than a CHECK, because CHECK
-- constraints must be immutable and "today" is not.
create or replace function public.enforce_adult_account()
returns trigger
language plpgsql
as $$
begin
  if new.date_of_birth > (current_date - interval '18 years') then
    raise exception 'Account holders must be 18 or older'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_adult
  before insert or update of date_of_birth on public.profiles
  for each row execute function public.enforce_adult_account();

alter table public.profiles enable row level security;

-- Display names appear next to public reading logs, so anyone may read them.
-- Only the columns the UI needs should be selected by public pages.
create policy "Profiles are readable by everyone"
  on public.profiles for select
  using (true);

create policy "Users create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy: deleting the auth user cascades to the profile.


-- Membership plans. Public catalogue data, managed by admins only.
create table public.plans (
  id              text primary key check (id in ('basic', 'standard', 'premium')),
  name            text not null,
  price_cents     integer not null check (price_cents > 0),
  currency        char(3) not null default 'USD',
  max_profiles    smallint not null check (max_profiles between 1 and 5),
  audio_hours     integer,           -- null means unlimited
  download_devices smallint not null check (download_devices >= 0),
  summary         text not null,
  sort_order      smallint not null default 0
);

alter table public.plans enable row level security;

create policy "Plans are readable by everyone"
  on public.plans for select
  using (true);

-- No insert/update/delete policies: only the service role manages plans.

insert into public.plans (id, name, price_cents, max_profiles, audio_hours, download_devices, summary, sort_order) values
  ('basic',    'Basic',    799,  1, 5,    1, 'Ebooks for one reader.',                       1),
  ('standard', 'Standard', 1299, 3, 30,   3, 'Reading and listening for a small household.', 2),
  ('premium',  'Premium',  1799, 5, null, 5, 'Unlimited listening for the whole family.',    3);


-- A user's membership. Card details are never stored: Stripe holds them, and we
-- keep only Stripe's IDs. Written by server-side code (Edge Function / Stripe
-- webhook), never directly by the browser.
create type public.subscription_status as enum ('active', 'paused', 'cancelled', 'past_due');

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users (id) on delete cascade,
  plan_id                text not null references public.plans (id),
  status                 public.subscription_status not null default 'active',
  billing_day            smallint not null check (billing_day between 1 and 28),
  renewal_terms_accepted_at timestamptz not null,   -- auto-renewal consent (ROSCA / state laws)
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "Users read their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies for members: plan changes, pauses and
-- cancellations go through an Edge Function using the service role, so the
-- browser can never set its own plan or status.
