-- BookWorm database schema (Supabase Postgres).
-- GENERATED from supabase/migrations by supabase/build-schema.sh. Edit the migrations, not this file.
-- Row Level Security is on for every table; supabase/tests/security_test.sql checks the policies.

-- =============================================================================
-- 20261024000100_accounts_plans_subscriptions.sql
-- =============================================================================
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

-- =============================================================================
-- 20261024000101_index_subscriptions_plan_id.sql
-- =============================================================================
-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);

-- =============================================================================
-- 20261024000200_reader_profiles.sql
-- =============================================================================
-- Phase 2: household reader profiles and parental consent.

create type public.age_rating as enum ('kids', 'teen', 'all');

-- Up to five profiles per account (fewer on smaller plans). Each has its own
-- lists, history and recommendations.
create table public.reader_profiles (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references auth.users (id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 1 and 20),
  -- Lower-cased name so two profiles on one account can't share a name.
  name_key            text generated always as (lower(btrim(name))) stored,
  avatar              smallint not null default 0 check (avatar between 0 and 5),
  age_rating          public.age_rating not null default 'all',
  -- One-way bcrypt hash of the 4-digit PIN; the PIN itself is never stored.
  pin_hash            text,
  has_pin             boolean generated always as (pin_hash is not null) stored,
  failed_pin_attempts smallint not null default 0 check (failed_pin_attempts between 0 and 5),
  locked_until        timestamptz,                    -- 15 minutes after 5 wrong PINs
  daily_limit_minutes smallint check (daily_limit_minutes between 30 and 240),
  favorite_genres     text[] not null default '{}' check (cardinality(favorite_genres) <= 30),
  -- Kids profiles exist only with a parent's consent (details in parental_consents).
  kids_consent_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Also serves as the index for account_id (leading column) used by RLS.
  unique (account_id, name_key),
  check (age_rating <> 'kids' or kids_consent_at is not null)
);

create trigger reader_profiles_set_updated_at
  before update on public.reader_profiles
  for each row execute function public.set_updated_at();

-- No more profiles than the plan allows, and never more than five. Runs with
-- the owner's rights so it can read the subscription; it reads only rows for
-- the account being inserted into.
create or replace function private.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed smallint;
  used    integer;
begin
  -- Serialize concurrent inserts for one account so two requests can't both
  -- slip under the limit.
  perform pg_advisory_xact_lock(hashtext('reader_profiles:' || new.account_id::text));

  select least(p.max_profiles, 5) into allowed
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = new.account_id and s.status in ('active', 'past_due');

  select count(*) into used from public.reader_profiles where account_id = new.account_id;

  if used >= coalesce(allowed, 1) then
    raise exception 'This plan allows % profile(s)', coalesce(allowed, 1)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_profile_limit() from public, anon, authenticated;

create trigger reader_profiles_enforce_limit
  before insert on public.reader_profiles
  for each row execute function private.enforce_profile_limit();

alter table public.reader_profiles enable row level security;

create policy "Account holders read their own profiles"
  on public.reader_profiles for select
  to authenticated
  using (account_id = (select auth.uid()));

-- The browser may add everyday profiles. Kids profiles, PINs and limits are
-- created through the manage-profile Edge Function after it re-checks the
-- account password (the column grants below stop the browser setting them).
create policy "Account holders add everyday profiles"
  on public.reader_profiles for insert
  to authenticated
  with check (account_id = (select auth.uid()) and age_rating <> 'kids');

create policy "Account holders edit their own profiles"
  on public.reader_profiles for update
  to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));

-- Deleting needs the account password, so it goes through the Edge Function.
-- No delete policy for browser roles.

revoke all on public.reader_profiles from anon, authenticated;
-- pin_hash is deliberately not selectable; has_pin says whether one is set.
grant select (id, account_id, name, avatar, age_rating, has_pin, failed_pin_attempts, locked_until,
              daily_limit_minutes, favorite_genres, kids_consent_at, created_at, updated_at)
  on public.reader_profiles to authenticated;
grant insert (account_id, name, avatar, age_rating, favorite_genres) on public.reader_profiles to authenticated;
grant update (name, avatar, favorite_genres) on public.reader_profiles to authenticated;


-- COPPA: who consented to a Kids profile, when and how. Kept after the profile
-- is deleted (profile_id becomes null) for as long as the law requires.
create table public.parental_consents (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references auth.users (id) on delete cascade,
  profile_id     uuid references public.reader_profiles (id) on delete set null,
  method         text not null default 'account_password_confirmation',
  notice_version text not null check (char_length(notice_version) between 1 and 40),
  consented_at   timestamptz not null default now(),
  withdrawn_at   timestamptz
);

-- Indexes on account_id and profile_id are in the 0201/0202 migrations
-- (CREATE INDEX CONCURRENTLY has to run on its own, outside a transaction).

alter table public.parental_consents enable row level security;

create policy "Account holders read their own consent records"
  on public.parental_consents for select
  to authenticated
  using (account_id = (select auth.uid()));

-- Written only by the manage-profile Edge Function (service role).
revoke all on public.parental_consents from anon, authenticated;
grant select on public.parental_consents to authenticated;

-- =============================================================================
-- 20261024000201_index_parental_consents_account_id.sql
-- =============================================================================
-- Foreign-key and RLS index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists parental_consents_account_id_idx on public.parental_consents (account_id);

-- =============================================================================
-- 20261024000202_index_parental_consents_profile_id.sql
-- =============================================================================
-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists parental_consents_profile_id_idx on public.parental_consents (profile_id);

-- =============================================================================
-- 20261024000300_server_functions_rate_limits.sql
-- =============================================================================
-- Server-only functions called by the Edge Functions, plus request rate limits.
--
-- Every function here is SECURITY DEFINER with an empty search_path and is
-- executable only by service_role (the Edge Functions). Browser roles can't
-- call them through PostgREST. The caller passes the account id it took from
-- a verified JWT; each function checks the profile belongs to that account.

-- -----------------------------------------------------------------------------
-- Rate limits (fixed windows). Keys are hashed so no IP address is stored.
-- -----------------------------------------------------------------------------

create table private.rate_limits (
  key_hash     bytea       not null,
  window_start timestamptz not null,
  hits         integer     not null default 1,
  primary key (key_hash, window_start)
);

-- Not exposed through the API (private schema), but RLS stays on as a backstop.
alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket timestamptz;
  used   integer;
begin
  if p_key is null or char_length(p_key) not between 1 and 200
     or p_limit not between 1 and 10000 or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate limit arguments' using errcode = 'invalid_parameter_value';
  end if;

  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limits as r (key_hash, window_start)
  values (extensions.digest(p_key, 'sha256'), bucket)
  on conflict (key_hash, window_start) do update set hits = r.hits + 1
  returning hits into used;

  -- Occasional cleanup of windows older than a day.
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;

  return used <= p_limit;
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;


-- -----------------------------------------------------------------------------
-- Profile PINs: hashed with bcrypt, 5 tries then a 15-minute lock
-- -----------------------------------------------------------------------------

create or replace function public.set_profile_pin(p_account_id uuid, p_profile_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_pin is not null and p_pin !~ '^\d{4}$' then
    raise exception 'A PIN is 4 digits' using errcode = 'invalid_parameter_value';
  end if;

  update public.reader_profiles
  set pin_hash = case when p_pin is null then null
                      else extensions.crypt(p_pin, extensions.gen_salt('bf', 10)) end,
      failed_pin_attempts = 0,
      locked_until = null
  where id = p_profile_id and account_id = p_account_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.set_profile_pin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_profile_pin(uuid, uuid, text) to service_role;


create or replace function public.verify_profile_pin(p_account_id uuid, p_profile_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.reader_profiles%rowtype;
  attempts smallint;
begin
  select * into p from public.reader_profiles
  where id = p_profile_id and account_id = p_account_id
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'no_data_found';
  end if;
  if p.pin_hash is null then
    return jsonb_build_object('ok', true);
  end if;
  if p.locked_until is not null and p.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked_until', p.locked_until, 'attempts_left', 0);
  end if;

  if p_pin ~ '^\d{4}$' and extensions.crypt(p_pin, p.pin_hash) = p.pin_hash then
    update public.reader_profiles set failed_pin_attempts = 0, locked_until = null where id = p.id;
    return jsonb_build_object('ok', true);
  end if;

  attempts := least(coalesce(p.failed_pin_attempts, 0) + 1, 5);
  update public.reader_profiles
  set failed_pin_attempts = case when attempts >= 5 then 0 else attempts end,
      locked_until = case when attempts >= 5 then now() + interval '15 minutes' else null end
  where id = p.id
  returning locked_until into p.locked_until;

  return jsonb_build_object('ok', false, 'attempts_left', greatest(5 - attempts, 0),
                            'locked_until', p.locked_until);
end;
$$;

revoke execute on function public.verify_profile_pin(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_profile_pin(uuid, uuid, text) to service_role;


-- Called after the Edge Function has re-checked the account password.
create or replace function public.unlock_profile(p_account_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reader_profiles
  set failed_pin_attempts = 0, locked_until = null
  where id = p_profile_id and account_id = p_account_id;

  if not found then
    raise exception 'Profile not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.unlock_profile(uuid, uuid) from public, anon, authenticated;
grant execute on function public.unlock_profile(uuid, uuid) to service_role;


-- -----------------------------------------------------------------------------
-- Kids profiles: created together with the parent's consent record
-- -----------------------------------------------------------------------------

create or replace function public.create_kids_profile(
  p_account_id uuid, p_name text, p_avatar smallint, p_daily_limit_minutes smallint, p_notice_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.reader_profiles (account_id, name, avatar, age_rating, daily_limit_minutes, kids_consent_at)
  values (p_account_id, btrim(p_name), coalesce(p_avatar, 0), 'kids', p_daily_limit_minutes, now())
  returning id into new_id;

  insert into public.parental_consents (account_id, profile_id, notice_version)
  values (p_account_id, new_id, p_notice_version);

  return new_id;
end;
$$;

revoke execute on function public.create_kids_profile(uuid, text, smallint, smallint, text) from public, anon, authenticated;
grant execute on function public.create_kids_profile(uuid, text, smallint, smallint, text) to service_role;

-- =============================================================================
-- 20261024000301_index_rate_limits_window_start.sql
-- =============================================================================
-- Lets the rate-limit cleanup find old windows quickly. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists rate_limits_window_start_idx on private.rate_limits (window_start);

-- =============================================================================
-- 20261024000302_rate_limits_deny_policy.sql
-- =============================================================================
-- Says out loud what RLS already does by default: browser roles can never touch
-- rate limit rows. Only the SECURITY DEFINER check_rate_limit function writes them.
create policy "No browser access to rate limits"
  on private.rate_limits as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

-- =============================================================================
-- 20261024000400_library_items_logs.sql
-- =============================================================================
-- The brief's library and logs.
--
-- Design problem: libraries are private, but logs are public on a book's page.
-- library_items has owner-only policies. logs has its own public read policy
-- and carries just enough to show a log (book id, author's display name, date),
-- so listing every log for a book never reads anyone's library.
-- A log can exist only for a book in its author's library: a composite foreign
-- key to library_items(user_id, volume_id) enforces it, and removing the book
-- deletes its logs (on delete cascade).

create type public.reading_status as enum ('want_to_read', 'reading', 'finished');

create table public.library_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Google Books volume id, checked against the format the API uses.
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  status     public.reading_status not null default 'want_to_read',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Also the index for user_id (RLS) and the target of logs' foreign key.
  unique (user_id, volume_id)
);

create trigger library_items_set_updated_at
  before update on public.library_items
  for each row execute function public.set_updated_at();

alter table public.library_items enable row level security;

create policy "Readers see their own library"
  on public.library_items for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add to their own library"
  on public.library_items for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers change status in their own library"
  on public.library_items for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers remove books from their own library"
  on public.library_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.library_items from anon, authenticated;
grant select, delete on public.library_items to authenticated;
grant insert (user_id, volume_id, status) on public.library_items to authenticated;
grant update (status) on public.library_items to authenticated;


create table public.logs (
  id         uuid primary key default gen_random_uuid(),
  -- References profiles so the book page can embed the display name.
  user_id    uuid not null references public.profiles (id) on delete cascade,
  volume_id  text not null,
  body       text not null check (char_length(btrim(body)) between 1 and 5000),
  rating     smallint check (rating between 1 and 5),   -- optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);
-- Indexes for the book page (volume_id, newest first) and the foreign key
-- (user_id, volume_id) are in the 0401/0402 migrations.

create trigger logs_set_updated_at
  before update on public.logs
  for each row execute function public.set_updated_at();

alter table public.logs enable row level security;

create policy "Logs are public"
  on public.logs for select
  to anon, authenticated
  using (true);

-- The foreign key does the "book is in my library" check; the policy makes
-- sure the library is the writer's own.
create policy "Readers write their own logs"
  on public.logs for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers edit their own logs"
  on public.logs for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers delete their own logs"
  on public.logs for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.logs from anon, authenticated;
grant select on public.logs to anon, authenticated;
grant insert (user_id, volume_id, body, rating) on public.logs to authenticated;
grant update (body, rating) on public.logs to authenticated;
grant delete on public.logs to authenticated;

-- =============================================================================
-- 20261024000401_index_logs_volume_id.sql
-- =============================================================================
-- Book page: every log for a volume, newest first. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists logs_volume_id_created_at_idx on public.logs (volume_id, created_at desc);

-- =============================================================================
-- 20261024000402_index_logs_user_id_volume_id.sql
-- =============================================================================
-- Composite foreign key to library_items and the user's own logs (RLS). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists logs_user_id_volume_id_idx on public.logs (user_id, volume_id);

-- =============================================================================
-- 20261024000500_reading_progress_bookmarks.sql
-- =============================================================================
-- Reading progress and bookmarks (Phase 7: the reader and the audiobook player).
--
-- Both are private to the account, like library_items, and belong to a book in
-- the account's library: a composite foreign key to library_items(user_id,
-- volume_id) enforces it, and removing the book deletes its progress and
-- bookmarks (on delete cascade). Opening a book in the reader or player adds it
-- to the library as "reading" first.

create type public.book_format as enum ('ebook', 'audiobook');

-- Where the account stopped in each book: one row per book, for Continue Reading.
create table public.reading_progress (
  user_id       uuid not null,
  volume_id     text not null,
  -- The format last used, so Continue Reading reopens the reader or the player.
  format        public.book_format not null,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  -- How far through the whole book, 0 to 1 (pages for ebooks, time for audiobooks).
  position      numeric(5, 4) not null check (position between 0 and 1),
  finished      boolean not null default false,
  updated_at    timestamptz not null default now(),
  -- Also the index for the foreign key and for RLS (user_id first).
  primary key (user_id, volume_id),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);

create trigger reading_progress_set_updated_at
  before update on public.reading_progress
  for each row execute function public.set_updated_at();

alter table public.reading_progress enable row level security;

create policy "Readers see their own progress"
  on public.reading_progress for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers save their own progress"
  on public.reading_progress for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers update their own progress"
  on public.reading_progress for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers clear their own progress"
  on public.reading_progress for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.reading_progress from anon, authenticated;
grant select, delete on public.reading_progress to authenticated;
grant insert (user_id, volume_id, format, chapter_index, position, finished) on public.reading_progress to authenticated;
grant update (format, chapter_index, position, finished) on public.reading_progress to authenticated;


-- Bookmarks: a named place in a book, in either format.
create table public.bookmarks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  volume_id     text not null,
  format        public.book_format not null,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  position      numeric(5, 4) not null check (position between 0 and 1),
  label         text not null check (char_length(btrim(label)) between 1 and 120),
  created_at    timestamptz not null default now(),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);
-- The foreign key's index (user_id, volume_id) is in the 0501 migration.

alter table public.bookmarks enable row level security;

create policy "Readers see their own bookmarks"
  on public.bookmarks for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add their own bookmarks"
  on public.bookmarks for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers remove their own bookmarks"
  on public.bookmarks for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Bookmarks are added and removed, never edited.
revoke all on public.bookmarks from anon, authenticated;
grant select, delete on public.bookmarks to authenticated;
grant insert (user_id, volume_id, format, chapter_index, position, label) on public.bookmarks to authenticated;

-- =============================================================================
-- 20261024000501_index_bookmarks_user_id_volume_id.sql
-- =============================================================================
-- Bookmarks' foreign key to library_items, and the reader's "bookmarks in this book" list. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists bookmarks_user_id_volume_id_idx on public.bookmarks (user_id, volume_id);
