-- LiteraryWorm database schema (Supabase Postgres).
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

-- =============================================================================
-- 20261024000600_profile_age_rating.sql
-- =============================================================================
-- Phase 8: changing a profile's age rating after it was created.
--
-- The browser can't set age_rating on an existing profile (no column grant), so
-- the manage-profile Edge Function calls this after re-checking the account
-- password. Moving a profile to Kids records the parent's consent, as
-- create_kids_profile does; moving it off Kids marks that consent withdrawn
-- (the record itself is kept for as long as the law requires).

create or replace function public.set_profile_age_rating(
  p_account_id uuid, p_profile_id uuid, p_age_rating public.age_rating, p_notice_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_rating public.age_rating;
begin
  select age_rating into current_rating from public.reader_profiles
  where id = p_profile_id and account_id = p_account_id
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'no_data_found';
  end if;
  if current_rating = p_age_rating then
    return;
  end if;

  if p_age_rating = 'kids' then
    if p_notice_version is null or char_length(p_notice_version) not between 1 and 40 then
      raise exception 'A Kids profile needs the parent''s consent' using errcode = 'check_violation';
    end if;
    update public.reader_profiles
    set age_rating = 'kids', kids_consent_at = now()
    where id = p_profile_id;
    insert into public.parental_consents (account_id, profile_id, notice_version)
    values (p_account_id, p_profile_id, p_notice_version);
  else
    update public.reader_profiles
    set age_rating = p_age_rating, kids_consent_at = null
    where id = p_profile_id;
    update public.parental_consents
    set withdrawn_at = now()
    where profile_id = p_profile_id and account_id = p_account_id and withdrawn_at is null;
  end if;
end;
$$;

revoke execute on function public.set_profile_age_rating(uuid, uuid, public.age_rating, text) from public, anon, authenticated;
grant execute on function public.set_profile_age_rating(uuid, uuid, public.age_rating, text) to service_role;

-- =============================================================================
-- 20261025000700_highlights.sql
-- =============================================================================
-- Highlights and notes (Phase 9: the reader's study tools).
--
-- A highlight marks a passage on one page of the ebook reader, in one of four
-- colours, and may carry a note. Like bookmarks they are private to the account
-- and belong to a book in its library: the composite foreign key to
-- library_items(user_id, volume_id) enforces it, and removing the book deletes
-- its highlights (on delete cascade).
--
-- The passage is found again by its page (chapter and page within the chapter)
-- and its character offsets in that page's text; `quote` keeps the words
-- themselves so the highlights list can show them without opening each page.

create type public.highlight_color as enum ('yellow', 'green', 'blue', 'pink');

create table public.highlights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  volume_id     text not null,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  -- 0-based page within the chapter.
  page          smallint not null check (page between 0 and 999),
  -- Character offsets in the page's text (paragraphs joined by a line break).
  start_offset  integer not null check (start_offset between 0 and 20000),
  end_offset    integer not null check (end_offset > start_offset and end_offset - start_offset <= 2000),
  quote         text not null check (char_length(btrim(quote)) between 1 and 2000),
  color         public.highlight_color not null default 'yellow',
  -- A note is optional; when present it can't be blank.
  note          text check (note is null or char_length(btrim(note)) between 1 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);
-- The foreign key's index (user_id, volume_id) is in the 0701 migration.

create trigger highlights_set_updated_at
  before update on public.highlights
  for each row execute function public.set_updated_at();

alter table public.highlights enable row level security;

create policy "Readers see their own highlights"
  on public.highlights for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add their own highlights"
  on public.highlights for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers edit their own highlights"
  on public.highlights for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers remove their own highlights"
  on public.highlights for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- The passage is fixed once highlighted; only the colour and the note change.
revoke all on public.highlights from anon, authenticated;
grant select, delete on public.highlights to authenticated;
grant insert (user_id, volume_id, chapter_index, page, start_offset, end_offset, quote, color, note) on public.highlights to authenticated;
grant update (color, note) on public.highlights to authenticated;

-- =============================================================================
-- 20261025000701_index_highlights_user_id_volume_id.sql
-- =============================================================================
-- Highlights' foreign key to library_items, and the reader's "highlights in this book" list. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists highlights_user_id_volume_id_idx on public.highlights (user_id, volume_id);

-- =============================================================================
-- 20261025000800_lists_ratings.sql
-- =============================================================================
-- Favourites, ratings, custom lists and recent searches (Phase 10).
--
-- These belong to one household profile, not the whole account: each profile
-- keeps its own taste and lists. Every row carries the account (user_id) for
-- RLS, and a composite foreign key to reader_profiles(id, account_id) makes
-- sure the profile is that account's (deleting the profile or the account
-- deletes its rows). Keys start with (profile_id, user_id), so they also index
-- those foreign keys.
--
-- A custom list can be shared by link: its share_slug is a random 22-character
-- token the owner sets and clears. public.shared_list() is the only way to read
-- a shared list without signing in, and returns only the list's name,
-- description, the profile's name and its titles. Kids profiles can't share.

-- Lets child tables require "this profile, of this account".
alter table public.reader_profiles add constraint reader_profiles_id_account_id_key unique (id, account_id);

-- The last eight searches, newest first (kept on the profile row).
alter table public.reader_profiles
  add column recent_searches text[] not null default '{}'
    check (cardinality(recent_searches) <= 8 and char_length(array_to_string(recent_searches, '')) <= 800);
grant update (recent_searches) on public.reader_profiles to authenticated;
grant select (recent_searches) on public.reader_profiles to authenticated;

-- Not for me / I like this / I love this.
create type public.taste_rating as enum ('not_for_me', 'like', 'love');

create table public.book_ratings (
  profile_id uuid not null,
  user_id    uuid not null,
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  rating     public.taste_rating not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create trigger book_ratings_set_updated_at
  before update on public.book_ratings
  for each row execute function public.set_updated_at();

create table public.favorites (
  profile_id uuid not null,
  user_id    uuid not null,
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create table public.custom_lists (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null,
  user_id     uuid not null,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  name_key    text generated always as (lower(btrim(name))) stored,
  description text not null default '' check (char_length(description) <= 200),
  -- Order on the Library page (0 first).
  position    smallint not null default 0 check (position between 0 and 99),
  -- Set while the list is shared by link; clearing it stops the link working.
  share_slug  text unique check (share_slug ~ '^[A-Za-z0-9_-]{22}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One name per profile; also the index for the foreign key below.
  unique (profile_id, user_id, name_key),
  -- The target of custom_list_items' foreign key.
  unique (id, user_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create trigger custom_lists_set_updated_at
  before update on public.custom_lists
  for each row execute function public.set_updated_at();

create table public.custom_list_items (
  list_id   uuid not null,
  user_id   uuid not null,
  volume_id text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  added_at  timestamptz not null default now(),
  primary key (list_id, user_id, volume_id),
  foreign key (list_id, user_id) references public.custom_lists (id, user_id) on delete cascade
);

-- Limits: 50 lists a profile, 200 books a list; and no sharing from Kids profiles.
create or replace function private.enforce_list_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'custom_lists' then
    if tg_op = 'INSERT' and (select count(*) from public.custom_lists where profile_id = new.profile_id) >= 50 then
      raise exception 'A profile can have up to 50 lists' using errcode = 'check_violation';
    end if;
    if new.share_slug is not null
       and (select age_rating from public.reader_profiles where id = new.profile_id) = 'kids' then
      raise exception 'Kids profiles can''t share lists' using errcode = 'check_violation';
    end if;
  elsif (select count(*) from public.custom_list_items where list_id = new.list_id) >= 200 then
    raise exception 'A list can hold up to 200 books' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_list_rules() from public, anon, authenticated;

create trigger custom_lists_rules
  before insert or update of share_slug on public.custom_lists
  for each row execute function private.enforce_list_rules();

create trigger custom_list_items_rules
  before insert on public.custom_list_items
  for each row execute function private.enforce_list_rules();

-- A profile that becomes Kids stops sharing its lists.
create or replace function private.unshare_kids_lists()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.age_rating = 'kids' and old.age_rating is distinct from 'kids' then
    update public.custom_lists set share_slug = null where profile_id = new.id and share_slug is not null;
  end if;
  return new;
end;
$$;
revoke execute on function private.unshare_kids_lists() from public, anon, authenticated;

create trigger reader_profiles_unshare_kids_lists
  after update of age_rating on public.reader_profiles
  for each row execute function private.unshare_kids_lists();

-- RLS: each account sees and changes only its own rows.
alter table public.book_ratings enable row level security;
alter table public.favorites enable row level security;
alter table public.custom_lists enable row level security;
alter table public.custom_list_items enable row level security;

create policy "Readers see their own ratings" on public.book_ratings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers rate as themselves" on public.book_ratings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers change their own ratings" on public.book_ratings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own ratings" on public.book_ratings for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own favourites" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers add their own favourites" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers remove their own favourites" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own lists" on public.custom_lists for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers create their own lists" on public.custom_lists for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers edit their own lists" on public.custom_lists for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers delete their own lists" on public.custom_lists for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own list books" on public.custom_list_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers add to their own lists" on public.custom_list_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers remove from their own lists" on public.custom_list_items for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.book_ratings, public.favorites, public.custom_lists, public.custom_list_items from anon, authenticated;
grant select, delete on public.book_ratings to authenticated;
grant insert (profile_id, user_id, volume_id, rating) on public.book_ratings to authenticated;
grant update (rating) on public.book_ratings to authenticated;
grant select, delete on public.favorites to authenticated;
grant insert (profile_id, user_id, volume_id) on public.favorites to authenticated;
grant select, delete on public.custom_lists to authenticated;
grant insert (profile_id, user_id, name, description, position) on public.custom_lists to authenticated;
grant update (name, description, position, share_slug) on public.custom_lists to authenticated;
grant select, delete on public.custom_list_items to authenticated;
grant insert (list_id, user_id, volume_id) on public.custom_list_items to authenticated;

-- A shared list, for anyone with its link: only the name, description, the
-- profile's name and the titles in the order they were added. Nothing when the
-- link is wrong, sharing has stopped, or the profile is Kids.
create or replace function public.shared_list(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', l.name,
    'description', l.description,
    'owner', p.name,
    'updatedAt', l.updated_at,
    'items', coalesce(
      (select jsonb_agg(i.volume_id order by i.added_at) from public.custom_list_items i where i.list_id = l.id),
      '[]'::jsonb
    )
  )
  from public.custom_lists l
  join public.reader_profiles p on p.id = l.profile_id
  where p_slug ~ '^[A-Za-z0-9_-]{22}$'
    and l.share_slug = p_slug
    and p.age_rating <> 'kids';
$$;
revoke execute on function public.shared_list(text) from public;
grant execute on function public.shared_list(text) to anon, authenticated;

-- =============================================================================
-- 20261028000900_book_summaries.sql
-- =============================================================================
-- AI-written book summaries, a short one and a detailed one per book.
--
-- The `summaries` Edge Function writes a book's summaries the first time
-- anyone asks for them (Claude, from the book's title, author and description)
-- and keeps them here, so each book is summarised once and every later reader
-- gets the same text. A book is a LiteraryWorm catalog id or a Google Books
-- volume id, the same ids library_items uses.
--
-- Only the function (service_role) reads and writes these rows; browser roles
-- have no access at all and go through the function.

create table public.book_summaries (
  volume_id        text        primary key check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  short_summary    text        not null check (char_length(btrim(short_summary)) between 1 and 600),
  detailed_summary text        not null check (char_length(btrim(detailed_summary)) between 1 and 8000),
  -- The Claude model that wrote them, so they can be rewritten when the model changes.
  model            text        not null check (char_length(model) between 1 and 80),
  created_at       timestamptz not null default now()
);

alter table public.book_summaries enable row level security;
revoke all on public.book_summaries from public, anon, authenticated;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch summaries.
create policy "No browser access to book summaries"
  on public.book_summaries as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

-- =============================================================================
-- 20261028001000_reading_goals.sql
-- =============================================================================
-- Reading goals and streaks (Phase 12).
--
-- Like favourites and lists, these belong to one household profile: every row
-- carries the account (user_id) for RLS and a composite foreign key to
-- reader_profiles(id, account_id), so the profile must be the account's and
-- deleting the profile or the account deletes its rows. Keys start with
-- (profile_id, user_id), so they also index those foreign keys.
--
-- reading_goals: a profile's target number of books for a year.
-- reading_days: minutes read or listened and books finished, per profile per
-- day (the device's date). Streaks and monthly summaries are worked out from
-- these rows in the app. The app adds to a day through record_reading(), which
-- adds atomically, so two tabs can't overwrite each other's minutes.

create table public.reading_goals (
  profile_id uuid not null,
  user_id    uuid not null,
  year       smallint not null check (year between 2020 and 2100),
  books      smallint not null check (books between 1 and 365),
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id, year),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create trigger reading_goals_set_updated_at
  before update on public.reading_goals
  for each row execute function public.set_updated_at();

create table public.reading_days (
  profile_id     uuid not null,
  user_id        uuid not null,
  day            date not null check (day >= date '2020-01-01'),
  minutes        smallint not null default 0 check (minutes between 0 and 1440),
  books_finished smallint not null default 0 check (books_finished between 0 and 100),
  primary key (profile_id, user_id, day),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.reading_goals enable row level security;
alter table public.reading_days enable row level security;

create policy "Readers see their own goals" on public.reading_goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers set their own goals" on public.reading_goals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers change their own goals" on public.reading_goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own goals" on public.reading_goals for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own reading days" on public.reading_days for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers record their own reading days" on public.reading_days for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers add to their own reading days" on public.reading_days for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own reading days" on public.reading_days for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.reading_goals, public.reading_days from anon, authenticated;
grant select, delete on public.reading_goals to authenticated;
grant insert (profile_id, user_id, year, books) on public.reading_goals to authenticated;
grant update (books) on public.reading_goals to authenticated;
grant select, delete on public.reading_days to authenticated;
grant insert (profile_id, user_id, day, minutes, books_finished) on public.reading_days to authenticated;
grant update (minutes, books_finished) on public.reading_days to authenticated;

-- Adds a little reading to a profile's day: at most an hour and one finished
-- book per call, for a day within two days of the database's date (devices sit
-- in different time zones). SECURITY INVOKER: RLS and the grants above apply,
-- so a caller can only add to their own profiles' days.
create or replace function public.record_reading(p_profile_id uuid, p_day date, p_minutes integer, p_finished integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_minutes is null or p_minutes not between 0 and 60 then
    raise exception 'minutes must be 0 to 60' using errcode = 'check_violation';
  end if;
  if p_finished is null or p_finished not between 0 and 1 then
    raise exception 'finished must be 0 or 1' using errcode = 'check_violation';
  end if;
  if p_day is null or p_day not between current_date - 2 and current_date + 2 then
    raise exception 'day must be within two days of today' using errcode = 'check_violation';
  end if;
  insert into public.reading_days as d (profile_id, user_id, day, minutes, books_finished)
  values (p_profile_id, (select auth.uid()), p_day, p_minutes, p_finished)
  on conflict (profile_id, user_id, day) do update
    set minutes = least(1440, d.minutes + excluded.minutes),
        books_finished = least(100, d.books_finished + excluded.books_finished);
end;
$$;

revoke execute on function public.record_reading(uuid, date, integer, integer) from public, anon;
grant execute on function public.record_reading(uuid, date, integer, integer) to authenticated;

-- =============================================================================
-- 20261028001001_index_reading_days_user_id.sql
-- =============================================================================
-- RLS on reading_days filters on user_id; the app loads an account's days by it.
create index concurrently if not exists reading_days_user_id_idx on public.reading_days (user_id);

-- =============================================================================
-- 20261028001002_index_reading_goals_user_id.sql
-- =============================================================================
-- RLS on reading_goals filters on user_id; the app loads an account's goals by it.
create index concurrently if not exists reading_goals_user_id_idx on public.reading_goals (user_id);

-- =============================================================================
-- 20261028001100_book_clubs.sql
-- =============================================================================
-- Book clubs (Phase 12).
--
-- A member starts a club around one LiteraryWorm title, with a finish date the
-- club paces itself to, and shares its invite code. Other members join with the
-- code through join_club(); nobody can find a club any other way. Members see
-- the club, each other's display names and the discussion, which is grouped by
-- chapter so the app can hide posts about chapters a reader hasn't reached.
--
-- Clubs belong to accounts (like the library), not household profiles; the app
-- doesn't offer them to Kids profiles. Leaving a club deletes your posts in it
-- (they're tied to the membership), and deleting a club deletes everything in it.

create table public.book_clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  volume_id   text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  starts_on   date not null default current_date,
  finishes_on date not null,
  -- 10 random letters and digits, made by the app; changing it stops the old code working.
  invite_code text not null unique check (invite_code ~ '^[A-Za-z0-9]{10}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (finishes_on > starts_on and finishes_on <= starts_on + 366)
);

create trigger book_clubs_set_updated_at
  before update on public.book_clubs
  for each row execute function public.set_updated_at();

create table public.club_members (
  club_id   uuid not null references public.book_clubs (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.club_posts (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  body          text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Only members post; leaving the club removes the membership and these posts.
  foreign key (club_id, user_id) references public.club_members (club_id, user_id) on delete cascade
);

create trigger club_posts_set_updated_at
  before update on public.club_posts
  for each row execute function public.set_updated_at();

-- Is the caller a member of this club? SECURITY DEFINER so policies on
-- club_members can use it without querying club_members under its own RLS
-- (which would recurse). It answers only about the caller, with a yes or no.
create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_club_member(uuid) from public, anon;
grant execute on function public.is_club_member(uuid) to authenticated;

-- The owner joins their own club; limits on clubs per account and posts per hour.
create or replace function private.book_club_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'book_clubs' then
    if (select count(*) from public.book_clubs where owner_id = new.owner_id) > 20 then
      raise exception 'An account can run up to 20 clubs' using errcode = 'check_violation';
    end if;
    insert into public.club_members (club_id, user_id) values (new.id, new.owner_id);
  elsif (select count(*) from public.club_posts
         where user_id = new.user_id and created_at > now() - interval '1 hour') > 60 then
    raise exception 'Too many posts. Wait a little and try again.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.book_club_rules() from public, anon, authenticated;

create trigger book_clubs_rules
  after insert on public.book_clubs
  for each row execute function private.book_club_rules();

create trigger club_posts_rules
  after insert on public.club_posts
  for each row execute function private.book_club_rules();

-- Joins the club with this invite code and returns its id, or null for a wrong
-- code. SECURITY DEFINER because a non-member can't see the club to join it;
-- it checks the code's shape, the caller, a 50-member cap, and limits tries
-- (20 an hour per account) so codes can't be guessed.
create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_club uuid;
begin
  if v_user is null then
    raise exception 'Log in to join a club' using errcode = 'insufficient_privilege';
  end if;
  if not public.check_rate_limit('join_club:' || v_user::text, 20, 3600) then
    raise exception 'Too many tries. Wait an hour and try again.' using errcode = 'check_violation';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9]{10}$' then
    return null;
  end if;
  select id into v_club from public.book_clubs where invite_code = p_code;
  if v_club is null then
    return null;
  end if;
  if not exists (select 1 from public.club_members where club_id = v_club and user_id = v_user) then
    if (select count(*) from public.club_members where club_id = v_club) >= 50 then
      raise exception 'This club is full (50 members)' using errcode = 'check_violation';
    end if;
    insert into public.club_members (club_id, user_id) values (v_club, v_user);
  end if;
  return v_club;
end;
$$;
revoke execute on function public.join_club(text) from public, anon;
grant execute on function public.join_club(text) to authenticated;

alter table public.book_clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_posts enable row level security;

create policy "Members see their clubs" on public.book_clubs for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_club_member(id));
create policy "Members start clubs as themselves" on public.book_clubs for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners change their clubs" on public.book_clubs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their clubs" on public.book_clubs for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Members see who is in their clubs" on public.club_members for select to authenticated
  using (public.is_club_member(club_id));
-- Leaving: anyone but the owner (who deletes the club instead); owners can also remove members.
create policy "Members leave, owners remove" on public.club_members for delete to authenticated
  using (
    exists (
      select 1 from public.book_clubs c
      where c.id = club_id
        and ((user_id = (select auth.uid()) and c.owner_id <> user_id) or (c.owner_id = (select auth.uid()) and user_id <> c.owner_id))
    )
  );

create policy "Members read their clubs' posts" on public.club_posts for select to authenticated
  using (public.is_club_member(club_id));
create policy "Members post as themselves" on public.club_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_club_member(club_id));
create policy "Members edit their own posts" on public.club_posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members delete their own posts, owners any in their club" on public.club_posts for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid()))
  );

revoke all on public.book_clubs, public.club_members, public.club_posts from anon, authenticated;
grant select, delete on public.book_clubs to authenticated;
-- The app makes the club's id, so it needn't read the new row back before the owner is a member.
grant insert (id, owner_id, name, volume_id, starts_on, finishes_on, invite_code) on public.book_clubs to authenticated;
grant update (name, finishes_on, invite_code) on public.book_clubs to authenticated;
grant select, delete on public.club_members to authenticated;
grant select, delete on public.club_posts to authenticated;
grant insert (club_id, user_id, chapter_index, body) on public.club_posts to authenticated;
grant update (body) on public.club_posts to authenticated;

-- =============================================================================
-- 20261028001101_index_book_clubs_owner_id.sql
-- =============================================================================
-- Index for the foreign key on book_clubs (owner_id).
create index concurrently if not exists book_clubs_owner_id_idx on public.book_clubs (owner_id);

-- =============================================================================
-- 20261028001102_index_club_members_user_id.sql
-- =============================================================================
-- Index for the foreign key on club_members (user_id).
create index concurrently if not exists club_members_user_id_idx on public.club_members (user_id);

-- =============================================================================
-- 20261028001103_index_club_posts_club_id_user_id.sql
-- =============================================================================
-- Index for the foreign key on club_posts (club_id, user_id), and for reading a club's posts.
create index concurrently if not exists club_posts_club_id_user_id_idx on public.club_posts (club_id, user_id);

-- =============================================================================
-- 20261028001104_index_club_posts_user_id.sql
-- =============================================================================
-- Index for the foreign key on club_posts (user_id).
create index concurrently if not exists club_posts_user_id_idx on public.club_posts (user_id);

-- =============================================================================
-- 20261028001200_player_settings_devices.sql
-- =============================================================================
-- The audiobook player's settings, and listening on another device (Phase 13).
--
-- Player settings belong to one household profile, like recent searches, so
-- they live on reader_profiles: volume, mute, how far the skip buttons move,
-- and whether each chapter's spoken introduction and closing announcement are
-- skipped as they come.
--
-- listening_devices: every open copy of the app while a member is signed in.
-- The browser makes the id (one per visit) and checks in every minute through
-- touch_listening_device(), which stamps the database's time. An account keeps
-- its 20 most recently seen devices; the app clears devices not seen for a day.
--
-- playback_handoffs: a book and a place sent from one of the account's devices
-- to another, for one of its profiles. The receiving device offers it (through
-- Supabase Realtime, and a check when the tab comes back) and marks it claimed.
-- Composite foreign keys keep the device and the profile the account's own;
-- clearing the device, the profile or the account clears its handoffs.

alter table public.reader_profiles
  add column player_volume        smallint not null default 100 check (player_volume between 0 and 100),
  add column player_muted         boolean  not null default false,
  add column skip_back_seconds    smallint not null default 15 check (skip_back_seconds in (5, 10, 15, 30, 45, 60)),
  add column skip_forward_seconds smallint not null default 15 check (skip_forward_seconds in (5, 10, 15, 30, 45, 60)),
  add column auto_skip_intro      boolean  not null default false,
  add column auto_skip_outro      boolean  not null default false;

grant select (player_volume, player_muted, skip_back_seconds, skip_forward_seconds, auto_skip_intro, auto_skip_outro)
  on public.reader_profiles to authenticated;
grant update (player_volume, player_muted, skip_back_seconds, skip_forward_seconds, auto_skip_intro, auto_skip_outro)
  on public.reader_profiles to authenticated;


create table public.listening_devices (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- "Chrome on Windows": worked out from the browser, shown in the list.
  label        text not null check (char_length(btrim(label)) between 1 and 60),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  -- Lets handoffs require "this device, of this account".
  unique (id, user_id)
);
-- The index for user_id (the foreign key and RLS) is in the 1201 migration.

alter table public.listening_devices enable row level security;

create policy "Members see their own devices" on public.listening_devices for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members add their own devices" on public.listening_devices for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Members check in their own devices" on public.listening_devices for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members clear their own devices" on public.listening_devices for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.listening_devices from anon, authenticated;
grant select, delete on public.listening_devices to authenticated;
grant insert (id, user_id, label) on public.listening_devices to authenticated;
grant update (last_seen_at) on public.listening_devices to authenticated;

-- Says a device is still open, with the database's clock (devices' clocks differ).
create or replace function public.touch_listening_device(p_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.listening_devices set last_seen_at = now()
  where id = p_id and user_id = (select auth.uid());
$$;

revoke execute on function public.touch_listening_device(uuid) from public, anon;
grant execute on function public.touch_listening_device(uuid) to authenticated;

-- An account keeps its 20 most recently seen devices: each visit adds one.
create or replace function public.keep_recent_listening_devices()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.listening_devices
  where user_id = new.user_id
    and id not in (
      select d.id from public.listening_devices d
      where d.user_id = new.user_id
      order by d.last_seen_at desc
      limit 20
    );
  return null;
end;
$$;

create trigger listening_devices_keep_recent
  after insert on public.listening_devices
  for each row execute function public.keep_recent_listening_devices();


create table public.playback_handoffs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  profile_id       uuid not null,
  volume_id        text not null check (char_length(volume_id) between 1 and 64),
  -- Where to carry on, in seconds from the start of the book.
  position_seconds integer not null check (position_seconds between 0 and 360000),
  -- The sending device's name as it was when sent.
  from_label       text not null check (char_length(btrim(from_label)) between 1 and 60),
  to_device_id     uuid not null,
  created_at       timestamptz not null default now(),
  -- Set when the receiving device picks it up or turns it down.
  claimed_at       timestamptz,
  foreign key (to_device_id, user_id) references public.listening_devices (id, user_id) on delete cascade,
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);
-- The foreign keys' indexes are in the 1202 and 1203 migrations.

alter table public.playback_handoffs enable row level security;

create policy "Members see their own handoffs" on public.playback_handoffs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members send their own handoffs" on public.playback_handoffs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Members claim their own handoffs" on public.playback_handoffs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members clear their own handoffs" on public.playback_handoffs for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.playback_handoffs from anon, authenticated;
grant select, delete on public.playback_handoffs to authenticated;
grant insert (user_id, profile_id, volume_id, position_seconds, from_label, to_device_id) on public.playback_handoffs to authenticated;
grant update (claimed_at) on public.playback_handoffs to authenticated;

-- The receiving device hears of new handoffs straight away (Realtime applies the RLS above).
alter publication supabase_realtime add table public.playback_handoffs;

-- =============================================================================
-- 20261028001201_index_listening_devices_user_id.sql
-- =============================================================================
-- RLS and the device list filter on user_id, newest check-in first; also indexes the foreign key.
create index concurrently if not exists listening_devices_user_id_last_seen_at_idx on public.listening_devices (user_id, last_seen_at);

-- =============================================================================
-- 20261028001202_index_playback_handoffs_to_device_id.sql
-- =============================================================================
-- A device looks up the handoffs sent to it; also indexes the (to_device_id, user_id) foreign key.
create index concurrently if not exists playback_handoffs_to_device_id_user_id_idx on public.playback_handoffs (to_device_id, user_id);

-- =============================================================================
-- 20261028001203_index_playback_handoffs_profile_id.sql
-- =============================================================================
-- Indexes the (profile_id, user_id) foreign key, so deleting a profile finds its handoffs quickly.
create index concurrently if not exists playback_handoffs_profile_id_user_id_idx on public.playback_handoffs (profile_id, user_id);

-- =============================================================================
-- 20261028001300_reading_stats.sql
-- =============================================================================
-- Reading stats and Year in Review (Phase 17).
--
-- reading_days.listening_minutes: of a day's minutes, how many were spent
-- listening to an audiobook (the rest is reading). Never more than the minutes.
--
-- finished_books: which book a profile finished on which day, so Year in Review
-- can list the year's books, their genres and authors. One row per book and day
-- (finishing a book again on another day is another row). Written only through
-- record_reading(), which now takes the listening minutes and the book.

alter table public.reading_days
  add column listening_minutes smallint not null default 0
    check (listening_minutes between 0 and 1440 and listening_minutes <= minutes);

grant insert (listening_minutes) on public.reading_days to authenticated;
grant update (listening_minutes) on public.reading_days to authenticated;

create table public.finished_books (
  profile_id  uuid not null,
  user_id     uuid not null,
  -- A catalog id or a Google Books volume id, in the format library_items uses.
  volume_id   text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  finished_on date not null check (finished_on >= date '2020-01-01'),
  created_at  timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id, finished_on),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.finished_books enable row level security;

create policy "Readers see their own finished books" on public.finished_books for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers record their own finished books" on public.finished_books for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers clear their own finished books" on public.finished_books for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.finished_books from anon, authenticated;
grant select, delete on public.finished_books to authenticated;
grant insert (profile_id, user_id, volume_id, finished_on) on public.finished_books to authenticated;

-- The old four-argument version is replaced: callers that leave out the new
-- arguments (older copies of the app) still work, through the defaults.
drop function public.record_reading(uuid, date, integer, integer);

-- Adds a little reading to a profile's day: at most an hour (of which some may
-- be listening) and one finished book per call, for a day within two days of
-- the database's date. With a finished book's id, also records which book.
-- SECURITY INVOKER: RLS and the grants apply, so a caller can only add to their
-- own profiles' days.
create function public.record_reading(
  p_profile_id uuid,
  p_day date,
  p_minutes integer,
  p_finished integer,
  p_listening_minutes integer default 0,
  p_volume_id text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_minutes is null or p_minutes not between 0 and 60 then
    raise exception 'minutes must be 0 to 60' using errcode = 'check_violation';
  end if;
  if p_listening_minutes is null or p_listening_minutes not between 0 and p_minutes then
    raise exception 'listening minutes must be 0 to the minutes' using errcode = 'check_violation';
  end if;
  if p_finished is null or p_finished not between 0 and 1 then
    raise exception 'finished must be 0 or 1' using errcode = 'check_violation';
  end if;
  if p_day is null or p_day not between current_date - 2 and current_date + 2 then
    raise exception 'day must be within two days of today' using errcode = 'check_violation';
  end if;
  insert into public.reading_days as d (profile_id, user_id, day, minutes, books_finished, listening_minutes)
  values (p_profile_id, (select auth.uid()), p_day, p_minutes, p_finished, p_listening_minutes)
  on conflict (profile_id, user_id, day) do update
    set minutes = least(1440, d.minutes + excluded.minutes),
        books_finished = least(100, d.books_finished + excluded.books_finished),
        listening_minutes = least(least(1440, d.minutes + excluded.minutes), d.listening_minutes + excluded.listening_minutes);
  if p_finished = 1 and p_volume_id is not null then
    insert into public.finished_books (profile_id, user_id, volume_id, finished_on)
    values (p_profile_id, (select auth.uid()), p_volume_id, p_day)
    on conflict do nothing;
  end if;
end;
$$;

revoke execute on function public.record_reading(uuid, date, integer, integer, integer, text) from public, anon;
grant execute on function public.record_reading(uuid, date, integer, integer, integer, text) to authenticated;

-- =============================================================================
-- 20261028001301_index_finished_books_user_id.sql
-- =============================================================================
-- RLS on finished_books filters on user_id; the app loads an account's finished books by it, newest first.
create index concurrently if not exists finished_books_user_id_finished_on_idx on public.finished_books (user_id, finished_on);

-- =============================================================================
-- 20261028001400_club_notifications.sql
-- =============================================================================
-- Club notifications (Phase 19).
--
-- club_members gains each member's last_read_at (when they last opened the
-- club, set by mark_club_read()) and notify (whether new posts alert them).
-- club_unread() counts the posts other members wrote since then, by chapter, so
-- the app can leave out chapters the reader hasn't reached (no spoilers in a
-- count or an alert). New posts reach open copies of the app through Supabase
-- Realtime; RLS means each member hears only their own clubs' posts.

alter table public.club_members
  add column last_read_at timestamptz not null default now(),
  add column notify       boolean     not null default true;

create policy "Members change their own membership" on public.club_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant update (notify, last_read_at) on public.club_members to authenticated;

-- Marks a club read for the caller, at the database's time.
create function public.mark_club_read(p_club_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.club_members
     set last_read_at = now()
   where club_id = p_club_id and user_id = (select auth.uid());
$$;

-- The caller's unread posts in each of their clubs, by chapter.
create function public.club_unread()
returns table (club_id uuid, chapter_index smallint, posts bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.club_id, p.chapter_index, count(*)
    from public.club_posts p
    join public.club_members m on m.club_id = p.club_id and m.user_id = (select auth.uid())
   where p.created_at > m.last_read_at
     and p.user_id <> (select auth.uid())
   group by p.club_id, p.chapter_index;
$$;

revoke execute on function public.mark_club_read(uuid), public.club_unread() from public, anon;
grant execute on function public.mark_club_read(uuid), public.club_unread() to authenticated;

alter publication supabase_realtime add table public.club_posts;

-- =============================================================================
-- 20261028001401_index_club_posts_club_id_created_at.sql
-- =============================================================================
-- club_unread() and each club's discussion read posts by club, newest after a time.
create index concurrently if not exists club_posts_club_id_created_at_idx on public.club_posts (club_id, created_at);

-- =============================================================================
-- 20261028001500_listen_along.sql
-- =============================================================================
-- Listen along (Phase 20).
--
-- A club member leads a listening session of the club's book; other members
-- join and hear the same place. club_listening holds one session per club: who
-- leads it, where they are and whether they're playing, and the speed. The host
-- updates it as they play, pause and skip (and every half minute, so a
-- session whose host has gone can be told apart); members hear each change
-- through Supabase Realtime and follow.
--
-- A session nobody has updated for two minutes has been left (the host closed
-- the app): any member may take it over by becoming its host. Only the host
-- moves it; the host or the club's owner can end it. Leaving the club, or
-- deleting it, ends the sessions that depended on it.

create table public.club_listening (
  club_id          uuid primary key references public.book_clubs (id) on delete cascade,
  host_id          uuid not null,
  position_seconds double precision not null check (position_seconds >= 0 and position_seconds < 1000000),
  playing          boolean not null default false,
  rate             real not null default 1 check (rate between 0.5 and 3),
  updated_at       timestamptz not null default now(),
  -- The host must be a member: leaving the club ends a session they lead.
  foreign key (club_id, host_id) references public.club_members (club_id, user_id) on delete cascade
);

create trigger club_listening_set_updated_at
  before update on public.club_listening
  for each row execute function public.set_updated_at();

alter table public.club_listening enable row level security;

create policy "Members see their clubs' sessions" on public.club_listening for select to authenticated
  using (public.is_club_member(club_id));
create policy "Members start a session as its host" on public.club_listening for insert to authenticated
  with check (host_id = (select auth.uid()) and public.is_club_member(club_id));
-- The host moves it; any member may take over a session left for two minutes.
create policy "Hosts move their session, members take over a left one" on public.club_listening for update to authenticated
  using (
    host_id = (select auth.uid())
    or (public.is_club_member(club_id) and updated_at < now() - interval '2 minutes')
  )
  with check (host_id = (select auth.uid()) and public.is_club_member(club_id));
create policy "Hosts and club owners end a session" on public.club_listening for delete to authenticated
  using (
    host_id = (select auth.uid())
    or exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid()))
  );

revoke all on public.club_listening from anon, authenticated;
grant select, delete on public.club_listening to authenticated;
grant insert (club_id, host_id, position_seconds, playing, rate) on public.club_listening to authenticated;
grant update (host_id, position_seconds, playing, rate) on public.club_listening to authenticated;

alter publication supabase_realtime add table public.club_listening;

-- =============================================================================
-- 20261028001501_index_club_listening_club_id_host_id.sql
-- =============================================================================
-- Index for the foreign key on club_listening (club_id, host_id) to club_members.
create index concurrently if not exists club_listening_club_id_host_id_idx on public.club_listening (club_id, host_id);

-- =============================================================================
-- 20261028001600_uploaded_books.sql
-- =============================================================================
-- Bring your own books (Phase 21).
--
-- A member uploads an EPUB they own. The browser reads it and keeps only its
-- text, chapter by chapter, as a JSON file in the private user-books bucket,
-- in a folder named after the account (so a member can only ever reach their
-- own files). uploaded_books lists them for the profile that uploaded them,
-- with the chapter titles and word counts the reader needs before the text
-- loads. Its id ("u-" and 32 hex digits) is a valid volume id, so the library,
-- reading progress, bookmarks and highlights work on uploads as on any book.
--
-- Kids profiles can't upload (the content isn't rated). A profile keeps up to
-- 50 uploads; each text file is at most 15 MB.

create table public.uploaded_books (
  id             text primary key check (id ~ '^u-[0-9a-f]{32}$'),
  profile_id     uuid not null,
  user_id        uuid not null,
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  author         text not null default '' check (char_length(author) <= 200),
  chapter_titles text[] not null check (cardinality(chapter_titles) between 1 and 500),
  chapter_words  integer[] not null check (cardinality(chapter_words) = cardinality(chapter_titles)),
  words          integer not null check (words between 1 and 5000000),
  -- The text's place in the user-books bucket: <user_id>/<id>.json.
  storage_path   text not null unique,
  created_at     timestamptz not null default now(),
  check (storage_path = user_id::text || '/' || id || '.json'),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.uploaded_books enable row level security;

create policy "Readers see their own uploads" on public.uploaded_books for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers upload to their own profiles" on public.uploaded_books for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers delete their own uploads" on public.uploaded_books for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.uploaded_books from anon, authenticated;
grant select, delete on public.uploaded_books to authenticated;
grant insert (id, profile_id, user_id, title, author, chapter_titles, chapter_words, words, storage_path) on public.uploaded_books to authenticated;

-- Not on Kids profiles, and up to 50 a profile.
create function private.enforce_upload_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select age_rating from public.reader_profiles where id = new.profile_id) = 'kids' then
    raise exception 'Kids profiles can''t upload books' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.uploaded_books where profile_id = new.profile_id) >= 50 then
    raise exception 'A profile can have up to 50 uploaded books' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_upload_rules() from public, anon, authenticated;

create trigger uploaded_books_rules
  before insert on public.uploaded_books
  for each row execute function private.enforce_upload_rules();

-- The bucket: private, JSON only, 15 MB a file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-books', 'user-books', false, 15728640, array['application/json'])
on conflict (id) do nothing;

-- Members read, add and remove files only in their own folder.
create policy "Members read their own book files" on storage.objects for select to authenticated
  using (bucket_id = 'user-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members add their own book files" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members remove their own book files" on storage.objects for delete to authenticated
  using (bucket_id = 'user-books' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =============================================================================
-- 20261028001601_index_uploaded_books_profile_id_user_id.sql
-- =============================================================================
-- Index for the foreign key on uploaded_books (profile_id, user_id); also the profile's list.
create index concurrently if not exists uploaded_books_profile_id_user_id_idx on public.uploaded_books (profile_id, user_id);

-- =============================================================================
-- 20261028001602_index_uploaded_books_user_id.sql
-- =============================================================================
-- RLS on uploaded_books filters on user_id; the app loads an account's uploads by it.
create index concurrently if not exists uploaded_books_user_id_idx on public.uploaded_books (user_id);

-- =============================================================================
-- 20261028001700_legal_pages.sql
-- =============================================================================
-- Staff roles, and editable legal pages (Phase 22).
--
-- staff_roles gives accounts access beyond being a member: admin (everything,
-- including granting roles), editor (the legal pages), and developer, billing,
-- customer_service and blog (recorded for the tools that will use them). An
-- account can hold several. Roles are granted and removed only by admins,
-- through grant_staff_role() and revoke_staff_role(); a role granted to an
-- email with no account yet waits in staff_invites and is applied when that
-- email signs up. A member sees only their own roles; admins see the team
-- through staff_members().
--
-- legal_pages holds the live copy of each footer page (Terms, Privacy,
-- Cookies, Copyright/DMCA, Accessibility, Children's Privacy, Privacy Choices,
-- Help, Status): anyone reads them; editors and admins change a page's title,
-- summary and sections. Each change stamps who made it and when and keeps the
-- page as it was in legal_page_revisions. Pages aren't added or removed from
-- the browser: the set is fixed with the footer.

create type public.staff_role as enum ('admin', 'developer', 'editor', 'billing', 'customer_service', 'blog');

create table public.staff_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.staff_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

-- Roles for emails that haven't signed up yet.
create table public.staff_invites (
  email      text not null check (email = lower(btrim(email)) and char_length(email) between 3 and 320),
  role       public.staff_role not null,
  invited_at timestamptz not null default now(),
  invited_by uuid references auth.users (id) on delete set null,
  primary key (email, role)
);

alter table public.staff_roles enable row level security;
alter table public.staff_invites enable row level security;
create policy "Members see their own roles" on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()));
-- No browser access to staff_invites: admins reach it through the functions below.
revoke all on public.staff_roles, public.staff_invites from anon, authenticated;
grant select on public.staff_roles to authenticated;

-- True when the caller holds the role, or is an admin (admins can do everything).
-- SECURITY INVOKER: it reads the caller's own rows.
create function public.has_staff_role(p_role public.staff_role)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = (select auth.uid()) and role in (p_role, 'admin')
  );
$$;
revoke execute on function public.has_staff_role(public.staff_role) from public, anon;
grant execute on function public.has_staff_role(public.staff_role) to authenticated;

-- The team, for admins: every account with a role, and every waiting invitation.
-- SECURITY DEFINER because it reads emails from auth.users; it checks the caller
-- is an admin first.
create function public.staff_members()
returns table (user_id uuid, email text, display_name text, roles public.staff_role[], invited boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('admin') then
    raise exception 'Only admins can see the team' using errcode = 'insufficient_privilege';
  end if;
  return query
    select s.user_id, lower(u.email)::text, p.display_name, array_agg(s.role order by s.role), false
      from public.staff_roles s
      join auth.users u on u.id = s.user_id
      left join public.profiles p on p.id = s.user_id
     group by s.user_id, u.email, p.display_name
    union all
    select null::uuid, i.email, null::text, array_agg(i.role order by i.role), true
      from public.staff_invites i
     group by i.email
     order by 2;
end;
$$;

-- Gives an account a role, by email. With no account for that email yet, the
-- role waits as an invitation. Returns 'granted' or 'invited'. Admins only.
create function public.grant_staff_role(p_email text, p_role public.staff_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
begin
  if not public.has_staff_role('admin') then
    raise exception 'Only admins can grant access' using errcode = 'insufficient_privilege';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'That isn''t an email address' using errcode = 'check_violation';
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    insert into public.staff_invites (email, role, invited_by) values (v_email, p_role, (select auth.uid()))
    on conflict do nothing;
    return 'invited';
  end if;
  insert into public.staff_roles (user_id, role, granted_by) values (v_user, p_role, (select auth.uid()))
  on conflict do nothing;
  return 'granted';
end;
$$;

-- Takes a role away (or withdraws an invitation, by email). Admins only; the
-- last admin can't be removed, so the team can't lock itself out.
create function public.revoke_staff_role(p_email text, p_role public.staff_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
begin
  if not public.has_staff_role('admin') then
    raise exception 'Only admins can remove access' using errcode = 'insufficient_privilege';
  end if;
  delete from public.staff_invites where email = v_email and role = p_role;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    return;
  end if;
  if p_role = 'admin' and (select count(*) from public.staff_roles where role = 'admin') <= 1
     and exists (select 1 from public.staff_roles where user_id = v_user and role = 'admin') then
    raise exception 'LiteraryWorm needs at least one admin' using errcode = 'check_violation';
  end if;
  delete from public.staff_roles where user_id = v_user and role = p_role;
end;
$$;

revoke execute on function public.staff_members(), public.grant_staff_role(text, public.staff_role), public.revoke_staff_role(text, public.staff_role) from public, anon;
grant execute on function public.staff_members(), public.grant_staff_role(text, public.staff_role), public.revoke_staff_role(text, public.staff_role) to authenticated;

-- A new account picks up any roles waiting for its email.
create function private.apply_staff_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.staff_roles (user_id, role, granted_by)
  select new.id, i.role, i.invited_by from public.staff_invites i where i.email = lower(new.email)
  on conflict do nothing;
  delete from public.staff_invites where email = lower(new.email);
  return new;
end;
$$;
revoke execute on function private.apply_staff_invites() from public, anon, authenticated;

create trigger apply_staff_invites
  after insert on auth.users
  for each row execute function private.apply_staff_invites();

create table public.legal_pages (
  slug       text primary key check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  position   smallint not null check (position between 0 and 99),
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  summary    text not null check (char_length(btrim(summary)) between 1 and 600),
  -- Each section's shape is checked by the edit trigger below.
  sections   jsonb not null default '[]' check (jsonb_typeof(sections) = 'array' and octet_length(sections::text) <= 200000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table public.legal_page_revisions (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null references public.legal_pages (slug) on delete cascade,
  title     text not null,
  summary   text not null,
  sections  jsonb not null,
  -- When this version was replaced, and by whom.
  replaced_at timestamptz not null default now(),
  replaced_by uuid references auth.users (id) on delete set null
);

alter table public.legal_pages enable row level security;
alter table public.legal_page_revisions enable row level security;

create policy "Anyone reads the legal pages" on public.legal_pages for select to anon, authenticated
  using (true);
create policy "Editors edit the legal pages" on public.legal_pages for update to authenticated
  using ((select public.has_staff_role('editor'))) with check ((select public.has_staff_role('editor')));
create policy "Editors read earlier versions" on public.legal_page_revisions for select to authenticated
  using ((select public.has_staff_role('editor')));
create policy "Edits record earlier versions" on public.legal_page_revisions for insert to authenticated
  with check ((select public.has_staff_role('editor')) and replaced_by = (select auth.uid()));

revoke all on public.legal_pages, public.legal_page_revisions from anon, authenticated;
grant select on public.legal_pages to anon, authenticated;
grant update (title, summary, sections) on public.legal_pages to authenticated;
grant select on public.legal_page_revisions to authenticated;
grant insert (slug, title, summary, sections, replaced_by) on public.legal_page_revisions to authenticated;

-- Each edit: check the sections, keep the page as it was, then stamp who
-- changed it and when. (The check is here rather than in a constraint so it
-- runs without editors needing the private schema.)
create function private.record_legal_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- An array of up to 40 { heading, paragraphs[] }: a heading of 1-120 characters and 1-60
  -- paragraphs of 1-5000 characters each.
  if jsonb_array_length(new.sections) > 40 or exists (
    select 1 from jsonb_array_elements(new.sections) sec
    where jsonb_typeof(sec) <> 'object'
       or jsonb_typeof(sec -> 'heading') is distinct from 'string'
       or char_length(btrim(sec ->> 'heading')) not between 1 and 120
       or jsonb_typeof(sec -> 'paragraphs') is distinct from 'array'
       or jsonb_array_length(sec -> 'paragraphs') not between 1 and 60
       or exists (
         select 1 from jsonb_array_elements(sec -> 'paragraphs') para
         where jsonb_typeof(para) <> 'string' or char_length(btrim(para #>> '{}')) not between 1 and 5000
       )
  ) then
    raise exception 'Each section needs a heading (up to 120 characters) and 1 to 60 paragraphs of up to 5000 characters; up to 40 sections'
      using errcode = 'check_violation';
  end if;
  if (new.title, new.summary, new.sections) is not distinct from (old.title, old.summary, old.sections) then
    return new;
  end if;
  insert into public.legal_page_revisions (slug, title, summary, sections, replaced_by)
  values (old.slug, old.title, old.summary, old.sections, (select auth.uid()));
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
revoke execute on function private.record_legal_edit() from public, anon, authenticated;

create trigger legal_pages_record_edit
  before update on public.legal_pages
  for each row execute function private.record_legal_edit();

-- =============================================================================
-- 20261028001701_index_legal_pages_updated_by.sql
-- =============================================================================
-- Index for the foreign key on legal_pages (updated_by).
create index concurrently if not exists legal_pages_updated_by_idx on public.legal_pages (updated_by);

-- =============================================================================
-- 20261028001702_index_legal_page_revisions_slug.sql
-- =============================================================================
-- Index for the foreign key on legal_page_revisions (slug).
create index concurrently if not exists legal_page_revisions_slug_idx on public.legal_page_revisions (slug, replaced_at);

-- =============================================================================
-- 20261028001703_index_legal_page_revisions_replaced_by.sql
-- =============================================================================
-- Index for the foreign key on legal_page_revisions (replaced_by).
create index concurrently if not exists legal_page_revisions_replaced_by_idx on public.legal_page_revisions (replaced_by);

-- =============================================================================
-- 20261028001704_seed_legal_pages.sql
-- =============================================================================
-- The legal pages' first copy, from the app's built-in text (generated by
-- supabase/build-legal-seed.py; don't edit by hand). Admins edit them afterwards.

insert into public.legal_pages (slug, position, title, summary, sections) values
  ($lw$accessibility$lw$, 0, $lw$Accessibility Policy$lw$, $lw$LiteraryWorm aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, so everyone at home can read and listen. This page says what we've built in, what we know isn't perfect yet, and how to tell us about a problem.$lw$, $lw$[{"heading": "What's built in", "paragraphs": ["The accessibility menu at the top of every page changes text size, theme (dark or light), an easier-to-read font, high contrast, underlined links and reduced motion. Your choices last for the visit.", "Every page works with a keyboard alone, and the player has keyboard shortcuts, listed under its controls. Buttons and links are at least 44 pixels square, focus is always visible, and dialogs keep focus inside them and return it when they close.", "Screen readers hear labelled controls, headings that outline each page, and announcements when something changes, such as a saved setting or a new club post. Pictures that carry meaning, like shared quote cards, have text alternatives; decorative covers are hidden from screen readers and their titles are always written nearby.", "In the reader you can choose the font, size, spacing, margins and theme. Audiobooks have speed control, a sleep timer, skip lengths you choose, and controls on your lock screen and headphones. The player's read-along transcript follows the narration."]}, {"heading": "What we know isn't perfect yet", "paragraphs": ["The read-along transcript for some titles is sample text rather than the exact recording, and is hidden while a real recording plays.", "Book details and covers from Google Books, and the LibriVox recordings, come from other services; we can't always fix problems in their content.", "Books you upload show their text only; images and tables in the original EPUB aren't shown."]}, {"heading": "How we check", "paragraphs": ["Every change is tested with a keyboard, at phone and desktop sizes, and with automated accessibility checks (Lighthouse accessibility scores of 100) before it's released."]}, {"heading": "Tell us about a problem", "paragraphs": ["If something is hard to use with your setup, tell us what you were trying to do, which page it was on, and the browser and assistive technology you use. We aim to reply within five working days and to fix problems that block reading or listening first. Contact details are on the Help page."]}]$lw$::jsonb),
  ($lw$privacy$lw$, 1, $lw$Privacy Policy$lw$, $lw$What we collect, why we collect it, who helps us run the service, how long we keep it, and how to download or delete it. We don't sell or license your personal information to anyone.$lw$, $lw$[{"heading": "What we collect", "paragraphs": ["Your account: your email address, display name, date of birth (to confirm you're 18 or over), whether you'd like marketing emails, when you accepted the Terms, and your plan. Your password is handled by our sign-in provider; we never see it.", "Your household: each profile's name, avatar, age rating, favourite genres, daily limit and player settings. A profile PIN is kept only as a one-way hash. For Kids profiles, we keep a record of the parent's consent.", "Your reading: your library, reading progress, bookmarks, highlights and notes, ratings, favourites and lists, recent searches, reading goals, time read and listened each day, and the books you finish.", "Things you share or add: reading logs (public, with your display name), book club posts (seen by the club's members), lists you choose to share by link, and books you upload (private to the profile that added them; we keep their text only).", "Devices: while you're signed in, a short label for each open copy of the app (such as “Chrome on Windows”) so you can send a book to another device."]}, {"heading": "Who helps us run LiteraryWorm", "paragraphs": ["Supabase stores the data above and runs our server functions. Vercel hosts the website. Neither may use your data for their own purposes.", "Anthropic (Claude) writes book summaries, and answers Ask the book questions. For Ask the book, we send your question and the book's public-domain text up to your chapter; we don't send your name, email or account details.", "Google Books answers searches and book details through our server, which sends only the search words and book ids, never who's asking. LibriVox recordings stream from the Internet Archive, and fonts load from Google Fonts, directly from your browser."]}, {"heading": "Licensing and selling your information", "paragraphs": ["We don't sell, rent or license your personal information, and we don't share it for advertising. We use it only to run LiteraryWorm for you.", "Content you post (reading logs and club posts) stays yours. The Terms of Service explain the limited licence you give us to show it where you posted it.", "We don't use your reading history, notes, uploads or posts to train AI models."]}, {"heading": "How long we keep it", "paragraphs": ["We keep your data while your account is open. Deleting a profile deletes its data, including its uploaded books. Deleting your account deletes everything at once, including your uploads; public logs and club posts go with it.", "To protect the service from abuse, we keep short-lived counts of requests, keyed by a one-way hash of your account or network address, and clear them within a day."]}, {"heading": "Your choices and rights", "paragraphs": ["In Account you can download a copy of your data, change your display name and marketing emails, and delete profiles or your whole account. You can remove any log, post, highlight or upload yourself.", "We honour Global Privacy Control. Children's data is covered by the Children's Privacy Notice, and what we keep in your browser by the Cookie Policy."]}]$lw$::jsonb),
  ($lw$cookies$lw$, 2, $lw$Cookie Policy$lw$, $lw$LiteraryWorm doesn't use cookies for advertising or tracking, and sets none of its own. This page lists what the app does keep in your browser, and why.$lw$, $lw$[{"heading": "Cookies", "paragraphs": ["LiteraryWorm sets no cookies. We don't use advertising, analytics or tracking cookies, and we don't let advertisers or social networks place them through our pages.", "Some book covers from Google Books, and the audiobook recordings streamed from the Internet Archive, load from those services. When your browser fetches them, those services may set or read their own cookies under their own policies. Blocking third-party cookies in your browser doesn't stop LiteraryWorm working."]}, {"heading": "What we keep in your browser", "paragraphs": ["Signed in: when you log in, your browser keeps your sign-in session (in local storage, under literaryworm-session) so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out.", "The app itself: so LiteraryWorm opens quickly and without a connection, your browser keeps a copy of the app's own files (its pages, code, icons and app manifest). This holds nothing about you.", "Books you save for offline: when you choose Read offline, the book's text, and its audio if you ask, are kept on your device until you remove them from the book's page.", "Books you upload: once you've opened one, its text is kept on that device so it keeps working if your connection drops. It's removed when you delete the book or log out.", "Everything else, such as reader settings, playback speed, the demo household and uploads made in the demo, stays in the open tab only and is gone when you refresh or close it."]}, {"heading": "What's saved with your account instead", "paragraphs": ["Your library, reading progress, bookmarks, highlights, lists, ratings, reading time, player settings, club activity and uploaded books are saved with your account on our servers (Supabase), not in browser cookies. The Privacy Policy says how we use them, and Account lets you download or delete them."]}, {"heading": "Your choices", "paragraphs": ["Because LiteraryWorm uses only what's strictly necessary, there's nothing to opt into and no cookie banner. You can clear what's kept at any time in your browser's site settings; you'll be signed out, and books saved for offline will need saving again. Notifications and installing the app as an app are always your choice, asked for by your browser.", "If this changes, for example if we ever add optional cookies, we'll ask you first and update this page."]}]$lw$::jsonb),
  ($lw$childrens-privacy$lw$, 3, $lw$Children's Privacy Notice$lw$, $lw$For parents and guardians: what a Kids profile collects, why, who can see it, and how you stay in control. Kids profiles collect only what the service needs, and only after you consent.$lw$, $lw$[{"heading": "Your consent comes first", "paragraphs": ["Only the account holder, who must be 18 or older, can create a Kids profile or move a profile to Kids, and only after reading this notice and confirming with the account password. We keep a record of that consent: when it was given, how, and which version of this notice it was for."]}, {"heading": "What a Kids profile collects", "paragraphs": ["The profile's first name or nickname and avatar, its age rating and any daily reading limit you set, and its reading: the books in its library, where it is in each book, bookmarks, highlights and notes, ratings, favourites and lists, reading time and goals.", "We don't ask a child for their email, full name, address, photo, location or any other contact details."]}, {"heading": "What a Kids profile can't do", "paragraphs": ["Kids profiles see only books rated for children. They can't write public reading logs, join or start book clubs, share lists by link, upload books, ask the book's AI assistant, make purchases or change account settings. A grown-up's password is needed to open Account or to allow extra time past a daily limit."]}, {"heading": "Who sees it", "paragraphs": ["A Kids profile's reading is private to your account. It isn't shown to other members, isn't used for advertising, and is never sold, rented or licensed. Our hosting providers (Supabase and Vercel) store it only to run LiteraryWorm for you."]}, {"heading": "Your choices as a parent", "paragraphs": ["From Account you can see and download the profile's data, change its limits, add a PIN to other profiles so a child can't open them, move the profile to another age rating, or delete it, which deletes everything it collected. You can withdraw consent at any time by deleting the profile."]}]$lw$::jsonb),
  ($lw$privacy-choices$lw$, 4, $lw$Your Privacy Choices$lw$, $lw$LiteraryWorm doesn't sell or share personal information for advertising and uses no non-essential cookies (see the Cookie Policy), so there's nothing to opt out of there. Global Privacy Control is honoured. Here are the choices you do have.$lw$, $lw$[{"heading": "Selling and sharing", "paragraphs": ["We don't sell, rent or license your personal information, and we don't share it for cross-context behavioural advertising. If your browser sends a Global Privacy Control signal, we treat it as a request to opt out, and nothing changes because we already don't do either."]}, {"heading": "Cookies and browser storage", "paragraphs": ["We set no cookies of our own and no advertising or analytics cookies. The Cookie Policy lists the strictly necessary things your browser keeps, such as your sign-in session, and how to clear them."]}, {"heading": "Emails and notifications", "paragraphs": ["Turn emails about new releases and offers on or off in Account → Preferences. Service emails, like password resets, always arrive. Book club alerts can be turned off for each club on its page, and browser notifications only appear if you allow them."]}, {"heading": "Your data", "paragraphs": ["In Account you can download a copy of your data, correct your display name, and delete profiles or your whole account. Reading logs, club posts, highlights and uploads can each be deleted whenever you like. The Privacy Policy explains what we keep and for how long."]}]$lw$::jsonb),
  ($lw$terms$lw$, 5, $lw$Terms of Service$lw$, $lw$The agreement between you and LiteraryWorm: who can have an account, how membership works, what you may do with the books, who owns what, and the licence you give us for what you post.$lw$, $lw$[{"heading": "Your account", "paragraphs": ["Account holders must be 18 or older. You may add profiles for people in your household, including Kids profiles with your consent, and you're responsible for how they're used.", "Keep your password private. You can change it, and delete your account, from Account at any time."]}, {"heading": "Membership", "paragraphs": ["Plans renew automatically each month until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. You can pause and resume from Account.", "LiteraryWorm is currently a demonstration: choosing a plan saves it to your account, but no payment is taken."]}, {"heading": "Your licence to read and listen", "paragraphs": ["While your membership is active, we give you a personal, non-exclusive, non-transferable, revocable licence to read and listen to the books in LiteraryWorm for your own and your household's non-commercial use, in the app.", "You may not copy, sell, share, broadcast or publicly perform the books, remove or get around any protection on them, or use them to train AI models. Books saved for offline reading stay in the app on your device.", "This licence doesn't apply to public-domain works themselves, which anyone may use freely; it covers our app, our edition and our service."]}, {"heading": "Who owns the books and the app", "paragraphs": ["Public-domain titles: the texts come from Project Gutenberg and the recordings from LibriVox, whose volunteers release their recordings into the public domain. These works are in the public domain in the United States; they may not be everywhere, so check your country's rules before using them outside LiteraryWorm.", "Other LiteraryWorm titles show sample pages, not the published books. Book details and covers from Google Books belong to their publishers and rights holders and are shown under Google's terms.", "Summaries and Ask the book answers are written by AI (Claude) and labelled so. They may be wrong; they're provided for your own reading and may not be republished as LiteraryWorm's.", "The LiteraryWorm name, logo, design and software belong to LiteraryWorm. Using the service doesn't give you any rights in them beyond these Terms."]}, {"heading": "What you post, and the licence you give us", "paragraphs": ["You own what you write: reading logs, club posts, list names and descriptions, notes and highlights.", "So we can run the features you use, you give LiteraryWorm a worldwide, non-exclusive, royalty-free licence to store, copy and display what you post, only where and to whom you posted it (logs on the book's public page with your display name, club posts to the club, shared lists to anyone with the link). The licence ends when you delete the content or your account, except for copies already made by others, such as someone else's screenshot.", "Notes, highlights and private lists are never shown to anyone else."]}, {"heading": "Books you upload", "paragraphs": ["Upload only books you have the right to read in this way, such as DRM-free books you've bought or works in the public domain. Don't upload books you don't have rights to, and don't remove DRM to upload them.", "Your uploads stay private to the profile that added them. We store their text only to show it to you, claim no rights in them, and delete them when you do or when you delete the profile or account."]}, {"heading": "Rules, changes and ending", "paragraphs": ["Don't post anything unlawful, hateful, harassing or infringing, impersonate others, spam clubs, or try to break or overload the service. We may remove content that breaks these rules and suspend accounts that keep doing so, including repeat copyright infringers (see Copyright/DMCA).", "LiteraryWorm is provided as is. We'll tell you before changing these Terms in ways that matter, and you can cancel or delete your account at any time."]}]$lw$::jsonb),
  ($lw$copyright$lw$, 6, $lw$Copyright/DMCA$lw$, $lw$How LiteraryWorm respects copyright, which works are in the public domain, and how a rights holder can report content they believe infringes, under the Digital Millennium Copyright Act (DMCA).$lw$, $lw$[{"heading": "Our books and their licences", "paragraphs": ["Public-domain titles use texts from Project Gutenberg and recordings from LibriVox, which LibriVox volunteers release into the public domain. These works are in the public domain in the United States, where LiteraryWorm operates. Our copies leave out Project Gutenberg's own header, footer and licence text.", "Other titles show sample pages written for LiteraryWorm, not the published books, and book details and covers come from Google Books under Google's terms.", "If you believe any of this is wrong, for example that a work isn't in the public domain, tell us using the steps below and we'll look into it promptly."]}, {"heading": "What people post or upload", "paragraphs": ["Reading logs, club posts and shared lists are written by members, who keep their rights in them. Books members upload are private to their own profile and aren't shown to anyone else; members must have the right to read them that way (see the Terms of Service)."]}, {"heading": "Reporting infringement", "paragraphs": ["If you believe something on LiteraryWorm infringes your copyright, send our designated agent a written notice that includes: your physical or electronic signature; the work you believe is infringed; the material on LiteraryWorm you want removed and where it is (a link helps); your name, address, phone number and email; a statement that you believe in good faith the use isn't authorised by the copyright owner, its agent or the law; and a statement, under penalty of perjury, that the notice is accurate and that you are, or are authorised to act for, the owner.", "Our designated agent's name, postal address, phone number and email, as registered with the U.S. Copyright Office, will be listed here before launch.", "We remove or disable access to the material, tell the member who posted it, and keep a record of the notice."]}, {"heading": "Counter-notices", "paragraphs": ["If your content was removed and you believe that was a mistake or that you had the right to post it, you may send a counter-notice with: your signature; what was removed and where it was; a statement, under penalty of perjury, that you believe in good faith it was removed by mistake or misidentification; your name, address and phone number; and your consent to the jurisdiction of the federal court for your address (or, outside the United States, any district where LiteraryWorm may be found) and to accept service from the person who sent the notice.", "We forward it to the person who sent the notice and may restore the content in 10 to 14 business days unless they tell us they've filed a court action."]}, {"heading": "Repeat infringers and false claims", "paragraphs": ["We close the accounts of members who repeatedly infringe copyright.", "Knowingly misrepresenting that material infringes, or that it was removed by mistake, can make you liable for damages under the DMCA, so please be sure before you send a notice or counter-notice."]}]$lw$::jsonb),
  ($lw$help$lw$, 7, $lw$Help$lw$, $lw$Answers to common questions about reading, listening, your library and your account, and how to report a problem.$lw$, $lw$[{"heading": "Where do the books come from?", "paragraphs": ["LiteraryWorm uses the Google Books API to show book details and covers when you browse and search, so you can find almost any book, save it to your library and write about it.", "The books you can read and listen to in full are public-domain classics: texts from Project Gutenberg and recordings from LibriVox. Other LiteraryWorm titles show sample pages."]}, {"heading": "Can I read my own books?", "paragraphs": ["Yes. In My Library → Uploads, add an EPUB you own that has no DRM. For example, buy a book that the publisher sells DRM-free on Google Play Books, download its EPUB from your Google Play Books library, then upload it to LiteraryWorm. Many publishers and stores sell DRM-free books, and public-domain EPUBs are free from Project Gutenberg and Standard Ebooks.", "Your upload opens in the reader with your place, bookmarks and highlights, and once you've opened it on a device, it keeps working there if your connection drops. Books with DRM can't be uploaded, and removing DRM to upload a book isn't allowed (see the Terms of Service)."]}, {"heading": "Reading and listening", "paragraphs": ["Open a book from its page with Read or Listen. Your place is shared between the two and across your devices. The mini-player keeps a book playing while you browse, and its controls also work from your lock screen and headphones.", "To read or listen without a connection, choose Read offline on a public-domain book's page."]}, {"heading": "Your account and household", "paragraphs": ["Each person at home can have their own profile, with its own library and recommendations. Lock a profile with a PIN, set daily limits for younger readers, and change your plan, password or emails in Account. You can cancel or pause online at any time."]}, {"heading": "Report a problem", "paragraphs": ["Tell us what you were doing, the page you were on, and your device and browser. Contact details for support will be published here before launch; until then, LiteraryWorm is a demonstration."]}]$lw$::jsonb),
  ($lw$status$lw$, 8, $lw$Status$lw$, $lw$All systems are working normally.$lw$, $lw$[{"heading": "Services", "paragraphs": ["Website and app: working normally.", "Accounts, libraries and reading progress: working normally.", "Book search and details (Google Books): working normally.", "Audiobook recordings (Internet Archive): working normally.", "Summaries and Ask the book (AI): working normally."]}, {"heading": "If something isn't working", "paragraphs": ["Your reading progress is saved on your device first and sent when the connection returns, so you won't lose your place. Books saved for offline keep working without a connection."]}]$lw$::jsonb)
on conflict (slug) do nothing;

-- =============================================================================
-- 20261028001705_index_staff_roles_granted_by.sql
-- =============================================================================
-- Index for the foreign key on staff_roles (granted_by).
create index concurrently if not exists staff_roles_granted_by_idx on public.staff_roles (granted_by);

-- =============================================================================
-- 20261028001706_index_staff_invites_invited_by.sql
-- =============================================================================
-- Index for the foreign key on staff_invites (invited_by).
create index concurrently if not exists staff_invites_invited_by_idx on public.staff_invites (invited_by);
