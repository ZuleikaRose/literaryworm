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
  ($lw$accessibility$lw$, 0, $lw$Accessibility Policy$lw$, $lw$This statement applies to the https://www.literaryworm.com website. LiteraryWorm is committed to ensuring our services are accessible to people with disabilities, so everyone at home can read and listen. We aim to conform with the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA.$lw$, $lw$[{"heading": "Accessibility features", "paragraphs": ["You should be able to change colors, contrast levels, and fonts; zoom in up to 200% without loss of information or functionality; navigate the website with just a keyboard, including keyboard shortcuts in the player; listen to the website using a screen reader, with labelled controls; use the read-along transcript with audiobooks; stop moving images with reduced motion; and turn on underlined links.", "The accessibility menu at the top of every page changes text size, theme (dark or light), an easier-to-read font, high contrast, underlined links and reduced motion. Your choices last for the visit.", "Every page works with a keyboard alone, and the player has keyboard shortcuts, listed under its controls. Buttons and links are at least 44 pixels square, focus is always visible, and dialogs keep focus inside them and return it when they close.", "Screen readers hear labelled controls, headings that outline each page, and announcements when something changes, such as a saved setting or a new club post. Pictures that carry meaning, like shared quote cards, have text alternatives; decorative covers are hidden from screen readers and their titles are always written nearby.", "In the reader you can choose the font, size, spacing, margins and theme. Audiobooks have speed control, a sleep timer, skip lengths you choose, and controls on your lock screen and headphones. The player's read-along transcript follows the narration."]}, {"heading": "Compatibility with assistive technology", "paragraphs": ["Our website is designed to be compatible with screen readers and other assistive technologies, using standard HTML and ARIA, in current versions of Chrome, Edge, Firefox and Safari. We haven't yet completed testing with each screen reader; if yours has trouble, please tell us."]}, {"heading": "Conformance status", "paragraphs": ["Status: partially conformant with WCAG 2.2 Level AA. Partially conformant means that most of the website conforms, with the exceptions listed under \"What we know isn't perfect yet\".", "We conducted our most recent accessibility evaluation in October 2026. For more information, see \"How we test\"."]}, {"heading": "What we know isn't perfect yet", "paragraphs": ["The read-along transcript for some titles is sample text rather than the exact recording, and is hidden while a real recording plays.", "Book details and covers from Google Books, and the LibriVox recordings, come from other services; we can't always fix problems in their content.", "Books you upload show their text only; images and tables in the original EPUB aren't shown."]}, {"heading": "How we test", "paragraphs": ["Every change is tested with a keyboard, at phone and desktop sizes, and with automated accessibility checks (Lighthouse accessibility scores of 100) before it's released."]}, {"heading": "Feedback and contact information", "paragraphs": ["Please let us know if you experience accessibility barriers using our services or need information in an alternative format. Tell us what you were trying to do, which page it was on, and the browser and assistive technology you use.", "Email: accessibility@literaryworm.com (mark the subject line \"Accessibility\").", "We aim to reply within five working days, and always within 15 business days, and to fix problems that block reading or listening first. We keep a record of accessibility feedback and our replies."]}, {"heading": "Enforcement", "paragraphs": ["If you're not satisfied with our response, you can contact the enforcement authority in your country: Germany: BFIT-Bund. France: Défenseur des droits. Ireland: National Disability Authority. Spain: OADIS. Italy: AgID. For other EU countries, contact your national consumer protection authority."]}, {"heading": "Preparation of this statement", "paragraphs": ["This statement was prepared on 28 October 2026 and is reviewed annually or when we make significant service changes.", "For questions about accessibility or this statement, email us at accessibility@literaryworm.com."]}]$lw$::jsonb),
  ($lw$privacy$lw$, 1, $lw$Privacy Policy$lw$, $lw$This Privacy Notice for LiteraryWorm ("we," "us," or "our") describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you visit our website at https://www.literaryworm.com or any website of ours that links to this Privacy Notice, or engage with us in other related ways.$lw$, $lw$[{"heading": "Questions or concerns?", "paragraphs": ["Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at usprivacy@literaryworm.com."]}, {"heading": "Summary of key points", "paragraphs": ["This summary provides key points from our Privacy Notice; you can find out more details about any of these topics in the numbered sections below.", "What personal information do we process? When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. See section 1.", "Do we process any sensitive personal information? Some information may be considered \"special\" or \"sensitive\" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, religious beliefs, biometric or financial data. We don't collect any of those. The only information we hold that some laws treat as sensitive is your account login information.", "Do we collect any information from third parties? We do not collect any information from third parties.", "How do we process your information? We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. See section 2.", "In what situations and with which parties do we share personal information? Only with the service providers that help us run LiteraryWorm, and in the specific situations described in section 4. We don't sell your personal information or share it for advertising.", "How do we keep your information safe? We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. See section 9.", "What are your rights? Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. See section 11.", "How do you exercise your rights? The easiest way is in Account, where you can download a copy of your data, change it, or delete it, or by contacting us at usprivacy@literaryworm.com. We will consider and act upon any request in accordance with applicable data protection laws."]}, {"heading": "1. What information do we collect?", "paragraphs": ["Personal information you disclose to us. In Short: We collect personal information that you provide to us.", "We collect personal information that you voluntarily provide to us when you register on the Services, when you participate in activities on the Services, or otherwise when you contact us.", "Personal Information Provided by You. The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. It includes your email address, display name, password, date of birth, contact preferences (marketing emails) and authentication data, and what you read, save and share in the app.", "Section 18 lists exactly what we keep.", "Sensitive Information. We do not collect biometric data, financial data, or other special categories of personal information.", "Payment Data. Payments are handled by Stripe (https://stripe.com/privacy), which collects and stores your card details; we never see or store your full card number. We keep the plan you chose, your billing day, Stripe's ids for your customer record and subscription, and whether each payment succeeded. If you buy a gift membership, we keep its code, plan, number of months and price, and whether and when it was redeemed (and, for a gift that starts on a later day, when we reminded the buyer). If you ask us to email a gift to someone, Stripe receives their email address and your message with the payment, and we keep both only until the email has gone; only the buyer can see the code, and we record which account redeemed it.", "Social Media Login Data. We don't offer registration or log in with social media accounts.", "All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.", "Information automatically collected. In Short: Some information — such as your Internet Protocol (IP) address and browser and device characteristics — is collected automatically when you visit our Services.", "Log and Usage Data. Our hosting and backend providers (Vercel and Supabase) automatically record service-related, diagnostic and performance information when you access the Services, in log files. This may include your IP address, browser type, the date and time of requests, the pages and files requested, and error reports. It is used to keep the Services secure and working, not for advertising, and we don't build profiles from it.", "Location Data. We don't collect your device's location, and we don't use GPS or similar technologies.", "Google API. We use the Google Books API only for book information: our server sends it search words, book ids and the names of authors people follow, never who's asking. Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements."]}, {"heading": "2. How do we process your information?", "paragraphs": ["In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes only with your prior explicit consent.", "To facilitate account creation and authentication and otherwise manage user accounts. We may process your information so you can create and log in to your account, as well as keep your account and household profiles in working order.", "To deliver and facilitate delivery of services to the user. We may process your information to provide you with the requested service, such as keeping your place in a book across devices, your bookmarks, highlights, lists, goals and stats.", "To respond to user inquiries/offer support to users. We may process your information to respond to your inquiries and solve any potential issues you might have with the requested service.", "To send administrative information to you. We may process your information to send you details about your account, changes to our terms and policies, and other similar information.", "To enable user-to-user communications. We may process your information if you choose to use any of our offerings that allow for communication with another user, such as reading logs, book clubs and shared lists. A book club's calendar link lets your calendar app read the club's meetings (their names, times and notes) from us; the link is yours, we don't store it, and it stops working if you leave the club.", "To send you marketing and promotional communications, only if you turned on marketing emails. You can turn them off at any time in Account. For more information, see section 11.", "To show you recommendations. Book recommendations and reading stats are worked out in your browser from your own reading; they aren't used for advertising.", "To protect our Services. We may process your information as part of our efforts to keep our Services safe and secure, including fraud monitoring and prevention and limiting how often our features can be used.", "To save or protect an individual's vital interest. We may process your information when necessary to save or protect an individual's vital interest, such as to prevent harm.", "We don't process your information to deliver targeted advertising."]}, {"heading": "3. What legal bases do we rely on to process your information?", "paragraphs": ["In Short: We only process your personal information when we believe it is necessary and we have a valid legal reason (i.e., legal basis) to do so under applicable law, like with your consent, to comply with laws, to provide you with services to enter into or fulfill our contractual obligations, to protect your rights, or to fulfill our legitimate business interests.", "If you are located in the EU or UK, this section applies to you. The General Data Protection Regulation (GDPR) and UK GDPR require us to explain the valid legal bases we rely on in order to process your personal information. As such, we may rely on the following legal bases to process your personal information:", "Consent. We may process your information if you have given us permission (i.e., consent) to use your personal information for a specific purpose, such as marketing emails or a Kids profile. You can withdraw your consent at any time (see section 11).", "Performance of a Contract. We may process your personal information when we believe it is necessary to fulfill our contractual obligations to you, including providing our Services or at your request prior to entering into a contract with you.", "Legitimate Interests. We may process your information when we believe it is reasonably necessary to achieve our legitimate business interests and those interests do not outweigh your interests and fundamental rights and freedoms: to diagnose problems and prevent fraudulent activities, and to keep the Services secure and working.", "Legal Obligations. We may process your information where we believe it is necessary for compliance with our legal obligations, such as to cooperate with a law enforcement body or regulatory agency, exercise or defend our legal rights, or disclose your information as evidence in litigation in which we are involved.", "Vital Interests. We may process your information where we believe it is necessary to protect your vital interests or the vital interests of a third party, such as situations involving potential threats to the safety of any person.", "If you are located in Canada, this section applies to you. We may process your information if you have given us specific permission (i.e., express consent) to use your personal information for a specific purpose, or in situations where your permission can be inferred (i.e., implied consent). You can withdraw your consent at any time.", "In some exceptional cases, we may be legally permitted under applicable law to process your information without your consent, including, for example: if collection is clearly in the interests of an individual and consent cannot be obtained in a timely way; for investigations and fraud detection and prevention; for business transactions provided certain conditions are met; if it is contained in a witness statement and the collection is necessary to assess, process, or settle an insurance claim; for identifying injured, ill, or deceased persons and communicating with next of kin; if we have reasonable grounds to believe an individual has been, is, or may be victim of financial abuse; if it is reasonable to expect collection and use with consent would compromise the availability or the accuracy of the information and the collection is reasonable for purposes related to investigating a breach of an agreement or a contravention of the laws of Canada or a province; if disclosure is required to comply with a subpoena, warrant, court order, or rules of the court relating to the production of records; if it was produced by an individual in the course of their employment, business, or profession and the collection is consistent with the purposes for which the information was produced; if the collection is solely for journalistic, artistic, or literary purposes; and if the information is publicly available and is specified by the regulations. We may disclose de-identified information for approved research or statistics projects, subject to ethics oversight and confidentiality commitments."]}, {"heading": "4. When and with whom do we share your personal information?", "paragraphs": ["In Short: We share information only with the service providers that help us run LiteraryWorm, and in the situations described in this section.", "Service providers. Supabase stores the data above and runs our server functions. Vercel hosts the website. Mailgun sends our emails (confirming your email address, resetting your password, and telling you when a book you set Remind me on is out, a weekly list of new books from authors you follow, a monthly round-up of what's new in LiteraryWorm if you turn it on, a weekly report of how your Kids profiles read (their names, reading and listening time, days read, books finished and any weekly goal) if you turn it on, a reminder the day before a book club you're in meets, and a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note, with the meeting as a calendar file), a daily email of new posts in your book clubs if you turn it on (each club's name and book, the chapters you've reached that have new posts, how many and the display names of who wrote them; never what they wrote), a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), a gift membership a member asked us to email to you (its code, plan and months, the buyer's display name and any message they wrote), and confirming that your account was deleted) and the book club invitations members send, so it receives the address each email goes to and the email's contents. We turn off Mailgun's open and click tracking. None of them may use your data for their own purposes.", "Stripe processes payments. When you add a payment method, Stripe receives your name, email address, card details and billing address, and handles them under its own privacy notice (https://stripe.com/privacy).", "Termly provides our cookie consent banner and our privacy request forms. Your browser loads the banner from Termly on each visit, so Termly receives those requests, including your IP address, and your consent choice is kept in your browser. Termly handles this under its own privacy policy (https://termly.io/our-privacy-policy/). It never handles payment details: Stripe does.", "Anthropic (Claude) writes book summaries, answers Ask the book questions and writes Who's who (see section 6).", "Google Books answers searches and book details through our server, which sends only the search words, book ids and the names of authors people follow, never who's asking. LibriVox recordings stream from the Internet Archive, and fonts load from Google Fonts, directly from your browser.", "Other members. Reading logs are public, with your display name. Book club posts are seen by the club's members. If you invite someone to a club by email, the invitation shows them your display name and the club's name, book and finish date; we send it through Mailgun and keep only a one-way fingerprint of their address for 30 days (so the same address isn't invited again within a week), never the address itself. Lists you share can be read by anyone with the link. Staff with the right access can see account details to run the service and help you.", "Our support team. To help with a question, LiteraryWorm staff with the customer service role (and admins) can look up an account by its email address. They see the name and email, when the account was made, whether the email is confirmed and two-step sign-in is on, the plan and its billing state (never card details), how many profiles there are, this month's listening against the plan, and the devices keeping books offline. They never see your library, reading, notes, highlights or searches. Every lookup is recorded with who made it and when, and the record is deleted after a year.", "Business Transfers. We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company."]}, {"heading": "5. Do we use cookies and other tracking technologies?", "paragraphs": ["In Short: We use only essential cookies and similar technologies, described in our Cookie Policy.", "When you first visit, a banner from Termly asks for your cookie choice, and you can change it at any time with Consent Preferences at the bottom of every page. Because we use only essential cookies, declining changes nothing about how the Services work.", "The technologies we use help us maintain the security of our Services and your account, keep you signed in, and let the app work offline.", "We don't permit third parties or service providers to use online tracking technologies on our Services for analytics or advertising, and we don't use Google Analytics or any other analytics or advertising service.", "Specific information about the technologies we use and how you can refuse certain cookies is set out in our Cookie Policy."]}, {"heading": "6. Do we offer artificial intelligence-based products?", "paragraphs": ["In Short: We offer products, features, or tools powered by artificial intelligence, machine learning, or similar technologies.", "As part of our Services, we offer features powered by artificial intelligence (\"AI Products\"). The terms in this Privacy Notice govern your use of the AI Products within our Services.", "Use of AI Technologies. We provide the AI Products through one third-party service provider (\"AI Service Provider\"): Anthropic (Claude). We don't use OpenAI, Hugging Face, Google Cloud AI, DeepSeek or Gemini to process your information. Figma Make was used only to design the app's screens and never receives your information. You must not use the AI Products in any way that violates the terms or policies of the AI Service Provider.", "Our AI Products. Book summaries: short and detailed summaries of books in our catalog, written the first time anyone asks, from the book's details; no personal information is sent. Ask the book: answers to your questions about a public-domain book. We send your question and the book's text up to your chapter; we don't send your name, email or account details. Who's who: the characters you've met in a public-domain book so far. We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one. Ask the book and Who's who aren't offered to Kids profiles. Summaries, answers and Who's who are labelled as written by AI.", "How We Process Your Data Using AI. All personal information processed using our AI Products is handled in line with this Privacy Notice and our agreement with the AI Service Provider. We don't use your reading history, notes, uploads or posts to train AI models."]}, {"heading": "7. How do we handle your social logins?", "paragraphs": ["We don't offer registration or log in using social media accounts. If we add it, we'll update this Privacy Notice first."]}, {"heading": "8. How long do we keep your information?", "paragraphs": ["In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.", "We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.", "When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible."]}, {"heading": "9. How do we keep your information safe?", "paragraphs": ["In Short: We aim to protect your personal information through a system of organizational and technical security measures.", "We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. For example, connections use HTTPS, and access rules in our database let each account read only its own data. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment."]}, {"heading": "10. Do we collect information from minors?", "paragraphs": ["In Short: We do not knowingly collect data from or market to children under 18 years of age or the equivalent age as specified by law in your jurisdiction, except through Kids profiles that a parent or guardian creates on their own account.", "Account holders must be 18 or older. We do not knowingly collect, solicit data from, or market to children under 18 years of age or the equivalent age as specified by law in your jurisdiction, nor do we knowingly sell such personal information. By using the Services, you represent that you are at least 18 or the equivalent age as specified by law in your jurisdiction or that you are the parent or guardian of such a minor and consent to such minor dependent's use of the Services through a Kids profile. The Children's Privacy Notice explains what Kids profiles keep.", "If we learn that personal information from users less than 18 years of age or the equivalent age as specified by law in your jurisdiction has been collected without that consent, we will deactivate the account and take reasonable measures to promptly delete such data from our records. If you become aware of any such data, please contact us at usprivacy@literaryworm.com."]}, {"heading": "11. What are your privacy rights?", "paragraphs": ["In Short: Depending on your state of residence in the US or in some regions, such as the European Economic Area (EEA), United Kingdom (UK), Switzerland, and Canada, you have rights that allow you greater access to and control over your personal information. You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.", "In some regions (like the EEA, UK, Switzerland, and Canada), you have certain rights under applicable data protection laws. These may include the right (i) to request access and obtain a copy of your personal information, (ii) to request rectification or erasure; (iii) to restrict the processing of your personal information; (iv) if applicable, to data portability; and (v) not to be subject to automated decision-making. If a decision that produces legal or similarly significant effects is made solely by automated means, we will inform you, explain the main factors, and offer a simple way to request human review. In certain circumstances, you may also have the right to object to the processing of your personal information. You can make such a request by contacting us by using the contact details provided in the section \"20. How can you contact us about this notice?\" below.", "We will consider and act upon any request in accordance with applicable data protection laws.", "If you are located in the UK and are unhappy with how we have handled your personal information, you can make a complaint directly to us at usprivacy@literaryworm.com. This is in addition to the rights you have under the UK General Data Protection Regulation and the Data Protection Act 2018.", "What happens after you complain: we will acknowledge your complaint within 30 days of receiving it, investigate without unjustifiable or excessive delay, keep you informed of progress and explain the outcome.", "If you are not happy with our final response, you can refer your complaint to the Information Commissioner's Office, the UK supervisory authority. Website: ico.org.uk/make-a-complaint. Helpline: 0303 123 1113. Post: Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF.", "If you are located in the EEA or UK and you believe we are unlawfully processing your personal information, you also have the right to complain to your Member State data protection authority or UK data protection authority.", "If you are located in Switzerland, you may contact the Federal Data Protection and Information Commissioner.", "Withdrawing your consent: If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time in Account (for marketing emails and Kids profiles) or by contacting us by using the contact details provided in the section \"20. How can you contact us about this notice?\" below.", "However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.", "Opting out of marketing and promotional communications: You can unsubscribe from our marketing and promotional communications at any time by turning off marketing emails in Account, by clicking on the unsubscribe link in the emails that we send, or by contacting us. We may still communicate with you, for example to send you service-related messages that are necessary for the administration and use of your account (emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account, and the monthly What's new email, the weekly Kids reading report and book club meeting emails have one-click unsubscribe links that work without signing in), to respond to service requests, or for other non-marketing purposes.", "Account Information. If you would at any time like to review or change the information in your account or terminate your account, you can log in and go to Account. There you can change your details, download a copy of your data, and delete profiles or your whole account. Deleting your account deletes its information from our databases straight away; copies in our providers' backups are removed when those backups expire.", "Cookies and similar technologies: Most Web browsers are set to accept cookies by default. If you prefer, you can usually choose to set your browser to remove cookies and to reject cookies. If you choose to remove cookies or reject cookies, this could affect certain features or services of our Services.", "If you have questions or comments about your privacy rights, you may email us at usprivacy@literaryworm.com."]}, {"heading": "12. Controls for Do-Not-Track features", "paragraphs": ["Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (\"DNT\") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. We don't track you across other websites in any case. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.", "California law requires us to let you know how we respond to web browser DNT signals. Because there currently is not an industry or legal standard for recognizing or honoring DNT signals, we do not respond to them at this time.", "Global Privacy Control: We recognize and honor Global Privacy Control (GPC) signals. If you use a browser or extension that supports GPC, we will treat this as a valid request to opt out of the sale or sharing of your personal information for targeted advertising purposes under applicable state privacy laws, including the California Consumer Privacy Act (CCPA). We don't sell or share personal information, so nothing more needs to change for you. For more information about GPC and how to enable it, visit globalprivacycontrol.org."]}, {"heading": "13. Do United States residents have specific privacy rights?", "paragraphs": ["In Short: If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, or Virginia, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. More information is provided below.", "Categories of Personal Information We Collect. These are the categories of personal information we have collected in the past twelve (12) months. For a full list of what we process, see sections 1 and 18.", "A. Identifiers (such as name, alias, online identifier, Internet Protocol address, email address, and account name): YES. Your email address, display name, account id, and IP address in our providers' logs.", "B. Personal information as defined in the California Customer Records statute (name, contact information, education, employment, employment history, and financial information): YES, your display name and email address only.", "C. Protected classification characteristics under state or federal law (gender, age, date of birth, race and ethnicity, national origin, marital status, and other demographic data): YES, your date of birth only, to confirm you're 18 or over.", "D. Commercial information (transaction information, purchase history, financial details, and payment information): YES. Your plan, billing day and payment history (amounts, dates and whether each payment succeeded), gift memberships you bought or redeemed (plan, months, price and when redeemed), with Stripe's ids for your customer record and subscription. Card details are held by Stripe, not us.", "E. Biometric information (fingerprints and voiceprints): NO.", "F. Internet or other similar network activity (browsing history, search history, online behavior, interest data, and interactions with our and other websites, applications, systems, and advertisements): YES, within LiteraryWorm only: your searches and reading activity on our Services. Not your activity on other websites.", "G. Geolocation data (device location): NO.", "H. Audio, electronic, sensory, or similar information (images and audio, video or call recordings): NO.", "I. Professional or employment-related information: NO.", "J. Education Information (student records and directory information): NO.", "K. Inferences drawn from collected personal information (a profile or summary of an individual's preferences and characteristics): YES. Book recommendations, worked out in your browser from your own reading and not used for advertising.", "L. Sensitive personal information: YES, account login information only. No biometric data.", "We will use and retain the personal information in each category for as long as the user has an account with us.", "We only collect sensitive personal information, as defined by applicable privacy laws or the purposes allowed by law or with your consent. Sensitive personal information may be used, or disclosed to a service provider or contractor, for additional, specified purposes. You may have the right to limit the use or disclosure of your sensitive personal information. We do not collect or process sensitive personal information for the purpose of inferring characteristics about you.", "We may also collect other personal information outside of these categories when you receive help through our customer support channels, or to deliver our Services and respond to your inquiries.", "Sources of Personal Information. See section 1. How We Use and Share Personal Information. See sections 2 and 4.", "Will your information be shared with anyone else? We may disclose your personal information with our service providers pursuant to a written contract between us and each service provider. See section 4. We may use your personal information for our own business purposes, such as for undertaking internal research for technological development and demonstration. This is not considered to be \"selling\" of your personal information.", "We have not disclosed, sold, or shared any personal information to third parties for a business or commercial purpose in the preceding twelve (12) months. We will not sell or share personal information in the future belonging to website visitors, users, and other consumers.", "Your Rights. You have rights under certain US state data protection laws. However, these rights are not absolute, and in certain cases, we may decline your request as permitted by law. These rights include: the right to know whether or not we are processing your personal data; to access your personal data; to correct inaccuracies in your personal data; to request the deletion of your personal data; to obtain a copy of the personal data you previously shared with us; to non-discrimination for exercising your rights; and to opt out of the processing of your personal data if it is used for targeted advertising (or sharing as defined under California's privacy law), the sale of personal data, or profiling in furtherance of decisions that produce legal or similarly significant effects (\"profiling\").", "Depending upon the state where you live, you may also have the right to access the categories of personal data being processed (including in Minnesota); to obtain a list of the categories of third parties to which we have disclosed personal data (including in California, Delaware, and Maryland); to obtain a list of specific third parties to which we have disclosed personal data (including in Minnesota and Oregon); to obtain a list of third parties to which we have sold personal data (including in Connecticut); to review, understand, question, and depending on where you live, correct how personal data has been profiled (including in Connecticut and Minnesota); to limit use and disclosure of sensitive personal data (including in California); and to opt out of the collection of sensitive data and personal data collected through the operation of a voice or facial recognition feature (including in Florida).", "How to Exercise Your Rights. To exercise these rights, you can use Account (to download, change or delete your data), email us at usprivacy@literaryworm.com, or use the contact details at the bottom of this document. We will honor your opt-out preferences if you enact the Global Privacy Control (GPC) opt-out signal on your browser.", "Under certain US state data protection laws, you can designate an authorized agent to make a request on your behalf. We may deny a request from an authorized agent that does not submit proof that they have been validly authorized to act on your behalf in accordance with applicable laws.", "Request Verification. Upon receiving your request, we will need to verify your identity to determine you are the same person about whom we have the information in our system. We will only use personal information provided in your request to verify your identity or authority to make the request. However, if we cannot verify your identity from the information already maintained by us, we may request that you provide additional information for the purposes of verifying your identity and for security or fraud-prevention purposes.", "If you submit the request through an authorized agent, we may need to collect additional information to verify your identity before processing your request and the agent will need to provide a written and signed permission from you to submit such request on your behalf.", "Appeals. Under certain US state data protection laws, if we decline to take action regarding your request, you may appeal our decision by emailing us at usprivacy@literaryworm.com. We will inform you in writing of any action taken or not taken in response to the appeal, including a written explanation of the reasons for the decisions. If your appeal is denied, you may submit a complaint to your state attorney general.", "California \"Shine The Light\" Law. California Civil Code Section 1798.83, also known as the \"Shine The Light\" law, permits our users who are California residents to request and obtain from us, once a year and free of charge, information about categories of personal information (if any) we disclosed to third parties for direct marketing purposes and the names and addresses of all third parties with which we shared personal information in the immediately preceding calendar year. We don't disclose personal information to third parties for their direct marketing. If you are a California resident and would like to make such a request, please submit your request in writing to us by using the contact details provided in the section \"20. How can you contact us about this notice?\" below."]}, {"heading": "14. Do other regions have specific privacy rights?", "paragraphs": ["In Short: You may have additional rights based on the country you reside in.", "Australia and New Zealand. We collect and process your personal information under the obligations and conditions set by Australia's Privacy Act 1988 and New Zealand's Privacy Act 2020 (Privacy Act).", "This Privacy Notice satisfies the notice requirements defined in both Privacy Acts, in particular: what personal information we collect from you, from which sources, for which purposes, and other recipients of your personal information.", "If you do not wish to provide the personal information necessary to fulfill their applicable purpose, it may affect our ability to provide our services, in particular to offer you the products or services that you want, respond to or help with your requests, manage your account with us, and confirm your identity and protect your account.", "At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in section 21.", "If you believe we are unlawfully processing your personal information, you have the right to submit a complaint about a breach of the Australian Privacy Principles to the Office of the Australian Information Commissioner and a breach of New Zealand's Privacy Principles to the Office of New Zealand Privacy Commissioner.", "Republic of South Africa. At any time, you have the right to request access to or correction of your personal information. You can make such a request by contacting us by using the contact details provided in section 21.", "If you are unsatisfied with the manner in which we address any complaint with regard to our processing of personal information, you can contact the office of the regulator, the Information Regulator (South Africa). General enquiries: enquiries@inforegulator.org.za. Complaints (complete POPIA/PAIA form 5): PAIAComplaints@inforegulator.org.za and POPIAComplaints@inforegulator.org.za."]}, {"heading": "15. Licensing and selling your information", "paragraphs": ["We don't sell, rent or license your personal information, and we don't share it for advertising. We use it only to run LiteraryWorm for you.", "Content you post (reading logs and club posts) stays yours. The Terms of Service explain the limited licence you give us to show it where you posted it.", "We don't use your reading history, notes, uploads or posts to train AI models."]}, {"heading": "16. How long we keep it", "paragraphs": ["We keep your data while your account is open. Deleting a profile deletes its data, including its uploaded books. Deleting your account deletes everything at once, including your uploads; public logs and club posts go with it.", "To protect the service from abuse, we keep short-lived counts of requests, keyed by a one-way hash of your account or network address, and clear them within a day."]}, {"heading": "17. Your choices and rights", "paragraphs": ["In Account you can download a copy of your data, change your display name and marketing emails, and delete profiles or your whole account. You can remove any log, post, highlight or upload yourself.", "You can also use the request form linked at the bottom of every page (Do Not Sell or Share My Personal information; Limit the Use Of My Sensitive Personal Information), provided by Termly.", "We honour Global Privacy Control. Children's data is covered by the Children's Privacy Notice, and what we keep in your browser by the Cookie Policy."]}, {"heading": "18. What we collect", "paragraphs": ["Your account: your email address, display name, password, date of birth (to confirm you're 18 or over), whether you'd like marketing emails, emails when a reminded book is out, weekly emails about new books from authors you follow, the monthly What's new email and the weekly Kids reading report (both off until you turn them on), book club meeting emails (reminders, and when a meeting moves or is cancelled; on until you turn them off), when you accepted the Terms, and your plan. Your password is handled by our sign-in provider and kept only as a one-way hash; we never see it.", "Your household: each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal and player settings, and whether it's set aside. A profile PIN is kept only as a one-way hash. For Kids profiles, we keep a record of the parent's consent.", "Your reading: your library, reading progress, bookmarks, highlights and notes, ratings, favourites and lists, the authors and narrators you follow (their pages show how many readers follow them, never who; and, for 60 days, the new books we find by the authors you follow), release reminders, recent searches, reading goals, the household challenges your profiles start or join, time read and listened each day, and the books you finish.", "Things you share or add: reading logs (public, with your display name), book club posts and whether you're coming to a club's meetings (seen by the club's members), lists you choose to share by link, and books you upload (private to the profile that added them; we keep their text only).", "Devices: while you're signed in, a short label for each browser you use the app in (such as \"Chrome on Windows\") so you can send a book to another device. For each device that keeps books with Read offline, the same kind of label and when it was last used, so your plan's offline devices can be counted and you can free one."]}, {"heading": "19. Do we make updates to this notice?", "paragraphs": ["In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.", "We may update this Privacy Notice from time to time. The updated version will be indicated by an updated \"Last updated\" date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information."]}, {"heading": "20. How can you contact us about this notice?", "paragraphs": ["If you have questions or comments about this notice, you may email us at usprivacy@literaryworm.com."]}, {"heading": "21. How can you review, update, or delete the data we collect from you?", "paragraphs": ["Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law.", "To review, update, or delete your personal information, go to Account, where you can download a copy of your data, change it, or delete it, or email us at usprivacy@literaryworm.com."]}]$lw$::jsonb),
  ($lw$cookies$lw$, 2, $lw$Cookie Policy$lw$, $lw$This Cookie Policy explains how LiteraryWorm ("Company," "we," "us," and "our") uses cookies and similar technologies to recognize you when you visit our website at https://www.literaryworm.com ("Website"). It explains what these technologies are and why we use them, as well as your rights to control our use of them.$lw$, $lw$[{"heading": "About this policy", "paragraphs": ["In some cases we may use cookies to collect personal information, or that becomes personal information if we combine it with other information."]}, {"heading": "What are cookies?", "paragraphs": ["Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information.", "Cookies set by the website owner (in this case, LiteraryWorm) are called \"first-party cookies.\" Cookies set by parties other than the website owner are called \"third-party cookies.\" Third-party cookies enable third-party features or functionality to be provided on or through the website (e.g., advertising, interactive content, and analytics). The parties that set these third-party cookies can recognize your computer both when it visits the website in question and also when it visits certain other websites."]}, {"heading": "Why do we use cookies?", "paragraphs": ["Some cookies are required for technical reasons in order for our Website to operate, and we refer to these as \"essential\" or \"strictly necessary\" cookies. LiteraryWorm uses only essential cookies and similar technologies. We don't use cookies to track or target your interests, and we don't let third parties serve cookies through our Website for advertising or analytics. This is described in more detail below."]}, {"heading": "How can I control cookies?", "paragraphs": ["You have the right to decide whether to accept or reject cookies. Essential cookies cannot be rejected as they are strictly necessary to provide you with services.", "When you first visit, a banner from Termly, our consent provider, asks for your choice, and you can change it at any time with Consent Preferences at the bottom of every page. LiteraryWorm uses only essential cookies, so declining changes nothing about how the site works: book covers, audiobooks and your account work either way. If we ever add cookies that aren't essential, they'll only be used with your consent, and we'll update this page.", "You may also set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our Website though your access to some functionality and areas of our Website may be restricted.", "The specific types of first- and third-party cookies served through our Website and the purposes they perform are described below (please note that the specific cookies served may vary depending on the specific Online Properties you visit)."]}, {"heading": "Essential website cookies", "paragraphs": ["These cookies are strictly necessary to provide you with services available through our Website and to use some of its features, such as access to secure areas.", "__cf_bm. Purpose: Cloudflare places the cookie on end-user devices that access customer sites protected by Bot Management or Bot Fight Mode. Provider: .supabase.co (our backend, Supabase, which is protected by Cloudflare). Service: Cloudflare (see Cloudflare's privacy policy). Type: server cookie. Expires in: 30 minutes.", "Some book covers from Google Books, the Google Books preview on some book pages (only when you open it), and the audiobook recordings streamed from the Internet Archive, load from those services. When your browser fetches them, those services may set or read their own cookies under their own policies. Blocking third-party cookies in your browser doesn't stop LiteraryWorm working."]}, {"heading": "Similar technologies: what we keep in your browser", "paragraphs": ["Signed in: when you log in, your browser keeps your sign-in session (in local storage, under literaryworm-session) so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out. Next to it the app keeps which of your devices this browser is (under literaryworm-device: a random id and your account's id, nothing else), so a refresh or a second tab isn't listed as a new device in Listen on another device; it's removed when you log out too.", "Your cookie choice: Termly keeps the choice you make in the banner, a random identifier for this browser and a count of visits in local storage (under TERMLY_API_CACHE), for up to 12 months, so the banner doesn't ask again on every visit. It sets no cookies. Your browser loads the banner from Termly (app.termly.io) on each visit, so Termly receives those requests, including your IP address, under its own privacy policy.", "The app itself: so LiteraryWorm opens quickly and without a connection, your browser keeps a copy of the app's own files (its pages, code, icons and app manifest). This holds nothing about you.", "Books you save for offline: when you choose Read offline, the book's text, and its audio if you ask, are kept on your device until you remove them from the book's page. Next to them the app keeps a small note of which account's offline place this device holds (a random id, not your name or email), so the place can be freed from another device; it goes when the books do.", "Books you upload: once you've opened one, its text is kept on that device so it keeps working if your connection drops. It's removed when you delete the book or log out.", "Everything else, such as reader settings, playback speed, the demo household and uploads made in the demo, stays in the open tab only and is gone when you refresh or close it.", "Your library, reading progress, bookmarks, highlights, lists, ratings, reading time, player settings, club activity and uploaded books are saved with your account on our servers (Supabase), not in browser cookies. The Privacy Policy says how we use them, and Account lets you download or delete them."]}, {"heading": "Do my choices apply on all my devices?", "paragraphs": ["No. Cookie settings you make in your browser, and anything you clear there, apply to that browser on that device only. You'll need to make them again on a different device or browser, and a private or incognito window deletes what it kept when you close it.", "Clearing LiteraryWorm's site data signs you out, and books saved for offline will need saving again."]}, {"heading": "How can I control cookies on my browser?", "paragraphs": ["As the means by which you can refuse cookies through your web browser controls vary from browser to browser, you should visit your browser's help menu for more information. This applies to the most popular browsers: Chrome, Internet Explorer, Firefox, Safari, Edge and Opera.", "In addition, most advertising networks offer you a way to opt out of targeted advertising. If you would like to find out more information, please visit the Digital Advertising Alliance, the Digital Advertising Alliance of Canada or the European Interactive Digital Advertising Alliance."]}, {"heading": "What about other tracking technologies, like web beacons?", "paragraphs": ["Cookies are not the only way to recognize or track visitors to a website. Web beacons (sometimes called \"tracking pixels\" or \"clear gifs\") are tiny graphics files that contain a unique identifier that lets a website recognize when someone has visited it or opened an email including them.", "LiteraryWorm doesn't use web beacons or tracking pixels on the Website or in its emails."]}, {"heading": "Do you serve targeted advertising?", "paragraphs": ["No. We don't serve advertising on our Website, and we don't allow third parties to place cookies or web beacons on your computer or mobile device through our Website to serve or measure advertising."]}, {"heading": "How often will you update this Cookie Policy?", "paragraphs": ["We may update this Cookie Policy from time to time in order to reflect, for example, changes to the cookies we use or for other operational, legal, or regulatory reasons. Please therefore revisit this Cookie Policy regularly to stay informed about our use of cookies and related technologies.", "The date at the top of this Cookie Policy indicates when it was last updated."]}, {"heading": "Where can I get further information?", "paragraphs": ["If you have any questions about our use of cookies or other technologies, please email us at support@literaryworm.com."]}]$lw$::jsonb),
  ($lw$childrens-privacy$lw$, 3, $lw$Children's Privacy Notice$lw$, $lw$For parents and guardians: what a Kids profile collects, why, who can see it, and how you stay in control. Kids profiles collect only what the service needs, and only after you consent.$lw$, $lw$[{"heading": "Your consent comes first", "paragraphs": ["Only the account holder, who must be 18 or older, can create a Kids profile or move a profile to Kids, and only after reading this notice and confirming with the account password. We keep a record of that consent: when it was given, how, and which version of this notice it was for."]}, {"heading": "What a Kids profile collects", "paragraphs": ["The profile's first name or nickname and avatar, its age rating and any daily reading limit and weekly reading goal you set, and its reading: the books in its library, where it is in each book, bookmarks, highlights and notes, ratings, favourites and lists, the authors and narrators it follows, release reminders, reading time and goals.", "We don't ask a child for their email, full name, address, photo, location or any other contact details."]}, {"heading": "What a Kids profile can't do", "paragraphs": ["Kids profiles see only books rated for children. They can't write public reading logs, join or start book clubs, share lists by link, upload books, ask the book's AI assistant, make purchases or change account settings. A grown-up's password is needed to open Account or to allow extra time past a daily limit."]}, {"heading": "Who sees it", "paragraphs": ["A Kids profile's reading is private to your account. It isn't shown to other members, isn't used for advertising, and is never sold, rented or licensed. Our hosting providers (Supabase and Vercel) store it only to run LiteraryWorm for you."]}, {"heading": "Your choices as a parent", "paragraphs": ["From Account you can see and download the profile's data, change its limits, add a PIN to other profiles so a child can't open them, move the profile to another age rating, or delete it, which deletes everything it collected. You can withdraw consent at any time by deleting the profile."]}]$lw$::jsonb),
  ($lw$privacy-choices$lw$, 4, $lw$Your Privacy Choices$lw$, $lw$LiteraryWorm doesn't sell or share personal information for advertising and uses no non-essential cookies (see the Cookie Policy), so there's nothing to opt out of there. Global Privacy Control is honoured. Here are the choices you do have.$lw$, $lw$[{"heading": "Selling and sharing", "paragraphs": ["We don't sell, rent or license your personal information, and we don't share it for cross-context behavioural advertising. If your browser sends a Global Privacy Control signal, we treat it as a request to opt out, and nothing changes because we already don't do either."]}, {"heading": "Cookies and browser storage", "paragraphs": ["We set no cookies of our own and no advertising or analytics cookies. The Cookie Policy lists the strictly necessary things your browser keeps, such as your sign-in session, and how to clear them."]}, {"heading": "Emails and notifications", "paragraphs": ["Turn emails about new releases and offers on or off in Account → Preferences. Service emails, like password resets, always arrive. Book club alerts can be turned off for each club on its page, and browser notifications only appear if you allow them."]}, {"heading": "Your data", "paragraphs": ["In Account you can download a copy of your data, correct your display name, and delete profiles or your whole account. Reading logs, club posts, highlights and uploads can each be deleted whenever you like. The Privacy Policy explains what we keep and for how long."]}]$lw$::jsonb),
  ($lw$terms$lw$, 5, $lw$Terms of Service$lw$, $lw$We are LiteraryWorm ("Company," "we," "us," "our"). We operate the website https://www.literaryworm.com (the "Site"), as well as any other related products and services that refer or link to these legal terms (the "Legal Terms") (collectively, the "Services"). These Legal Terms cover who can have an account, how membership works, what you may do with the books, who owns what, and the license you give us for what you post. You can contact us by email at support@literaryworm.com.$lw$, $lw$[{"heading": "Agreement to our legal terms", "paragraphs": ["These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity (\"you\"), and LiteraryWorm, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.", "Supplemental terms and conditions or documents that may be posted on the Services from time to time, such as our End User License Agreement (https://www.literaryworm.com/legal/eula), are hereby expressly incorporated herein by reference. We may change these Legal Terms from time to time. We'll tell you before changing them in ways that matter, and we'll update the \"Last updated\" date. You will be subject to, and will be deemed to have accepted, the changes in any revised Legal Terms by your continued use of the Services after the date such revised Legal Terms are posted.", "Account holders must be at least 18 years old. People under 18 may use the Services only through a profile, such as a Kids profile, that a parent or guardian adds to their own account and is responsible for.", "We recommend that you print a copy of these Legal Terms for your records."]}, {"heading": "1. Our services", "paragraphs": ["The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.", "The Services are not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use the Services. You may not use the Services in a way that would violate the Gramm-Leach-Bliley Act (GLBA)."]}, {"heading": "2. Intellectual property rights", "paragraphs": ["Our intellectual property. We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the \"Content\"), as well as the trademarks, service marks, and logos contained therein (the \"Marks\"). Section 32 explains which books are in the public domain and who owns the rest.", "Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties in the United States and around the world.", "The Content and Marks are provided in or through the Services \"AS IS\" for your personal, non-commercial use only.", "Your use of our Services. Subject to your compliance with these Legal Terms, including the \"Prohibited activities\" section below, we grant you a non-exclusive, non-transferable, revocable license to access the Services, solely for your personal, non-commercial use. What you may do with the books is set out in section 31.", "Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.", "If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: support@literaryworm.com. If we ever grant you the permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.", "We reserve all rights not expressly granted to you in and to the Services, Content, and Marks. Being able to see source code we publish doesn't give you a license to use it.", "Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.", "Your submissions. By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services (\"Submissions\"), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.", "Your contributions. What you post in the Services (reading logs, club posts, ratings, list names and descriptions, notes and highlights) are \"Contributions\", covered by sections 9, 10 and 33. You own them, and the license you give us is the limited one in section 33. Contributions you make public may be seen by anyone, including through links you share outside the Services.", "You are responsible for what you post or upload. By sending us Submissions and/or posting Contributions, you: confirm that you have read and agree with our \"Prohibited activities\" and will not post, send, publish, upload, or transmit through the Services any Submission nor post any Contribution that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading; warrant that any such Submission and/or Contributions are original to you or that you have the necessary rights and licenses to submit them and full authority to grant us the rights in these Legal Terms; and warrant and represent that your Submissions and/or Contributions do not constitute confidential information. You are solely responsible for your Submissions and/or Contributions and you expressly agree to reimburse us for any and all losses that we may suffer because of your breach of (a) this section, (b) any third party's intellectual property rights, or (c) applicable law.", "We may remove your Contributions. Although we have no obligation to monitor any Contributions, we shall have the right to remove any Contributions at any time without notice if in our reasonable opinion we consider such Contributions harmful or in breach of these Legal Terms. If we remove any such Contributions, we may also suspend or disable your account and report you to the authorities.", "Copyright infringement. We respect the intellectual property rights of others. If you believe that any material available on or through the Services infringes upon any copyright you own or control, please refer to section 15 and our Copyright/DMCA page."]}, {"heading": "3. User representations", "paragraphs": ["By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Legal Terms; (4) if you hold an account, you are at least 18 and not a minor in the jurisdiction in which you reside; (5) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (6) you will not use the Services for any illegal or unauthorized purpose; and (7) your use of the Services will not violate any applicable law or regulation.", "If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your account and refuse any and all current or future use of the Services (or any portion thereof)."]}, {"heading": "4. User registration", "paragraphs": ["You need to register to use most of the Services. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a display name or profile name you select if we determine, in our sole discretion, that it is inappropriate, obscene, or otherwise objectionable."]}, {"heading": "5. Purchases and payment", "paragraphs": ["LiteraryWorm is a live service: when you choose a plan, you're billed monthly or yearly (as you choose) through Stripe until you cancel. Add a payment method in Account → Plan and billing to continue your membership.", "We accept the following forms of payment: Visa, Mastercard, American Express and Discover.", "You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Services. You further agree to promptly update account and payment information, including email address, payment method, and payment card expiration date, so that we can complete your transactions and contact you as needed. Sales tax will be added to the price of purchases as deemed required by us. We may change prices at any time. All payments shall be in US dollars.", "You agree to pay all charges at the prices then in effect for your purchases, and you authorize us to charge your chosen payment provider for any such amounts upon placing your order. We reserve the right to correct any errors or mistakes in pricing, even if we have already requested or received payment.", "We reserve the right to refuse any order placed through the Services. We may, in our sole discretion, limit or cancel quantities purchased per person, per household, or per order. These restrictions may include orders placed by or under the same customer account or the same payment method. We reserve the right to limit or prohibit orders that, in our sole judgment, appear to be placed by dealers, resellers, or distributors."]}, {"heading": "6. Subscriptions", "paragraphs": ["Billing and renewal. Your subscription will continue and automatically renew each month on your billing day (or, if you pay yearly, each year on the date your year started) unless canceled. You consent to our charging your payment method on a recurring basis without requiring your prior approval for each recurring charge, until such time as you cancel. You can change your billing day to any day from the 1st to the 28th in Account.", "Cancellation and pausing. You can pause, resume or cancel your subscription at any time from Account. A pause stops billing until you resume. To stop the next charge, cancel at least 48 hours before your next billing date: your cancellation then takes effect at the end of the current paid term. If you cancel less than 48 hours before your billing date, that charge still goes through and your cancellation takes effect at the end of the term it pays for. No refunds are given for any part of a term. If you have any questions or are unsatisfied with our Services, please email us at support@literaryworm.com.", "Fee changes. We may, from time to time, make changes to the subscription fee and will communicate any price changes to you in accordance with applicable law."]}, {"heading": "7. Software", "paragraphs": ["Our End User License Agreement (https://www.literaryworm.com/legal/eula) governs your use of the LiteraryWorm app, in the browser or installed on a device. Any other software we provide in connection with our Services is licensed to you on a non-exclusive, revocable, personal, and non-transferable basis, solely in connection with our Services and in accordance with these Legal Terms. Any software and any related documentation is provided \"AS IS\" without warranty of any kind, either express or implied, including, without limitation, the implied warranties of merchantability, fitness for a particular purpose, or non-infringement. You accept any and all risk arising out of use or performance of any software. You may not reproduce or redistribute any software except in accordance with the EULA or these Legal Terms."]}, {"heading": "8. Prohibited activities", "paragraphs": ["You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.", "As a user of the Services, you agree not to:", "1. Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.", "2. Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords or profile PINs.", "3. Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein, such as daily reading limits and age ratings.", "4. Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.", "5. Use any information obtained from the Services in order to harass, abuse, or harm another person.", "6. Make improper use of our support services or submit false reports of abuse or misconduct.", "7. Use the Services in a manner inconsistent with any applicable laws or regulations.", "8. Engage in unauthorized framing of or linking to the Services.", "9. Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.", "10. Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.", "11. Delete the copyright or other proprietary rights notice from any Content.", "12. Attempt to impersonate another user or person or use the display name of another user.", "13. Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats (\"gifs\"), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as \"spyware\" or \"passive collection mechanisms\" or \"pcms\").", "14. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services, including by trying to get around the limits on AI summaries, Ask the book and Who's who.", "15. Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.", "16. Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.", "17. Copy or adapt the Services' software, including but not limited to HTML, JavaScript, or other code.", "18. Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.", "19. Except as may be the result of standard search engine or Internet browser usage, or the Services' own Read offline feature, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.", "20. Use a buying agent or purchasing agent to make purchases on the Services.", "21. Make any unauthorized use of the Services, including collecting display names and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.", "22. Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.", "23. Sell or otherwise transfer your account or a profile.", "24. Use the Services to advertise or offer to sell goods and services."]}, {"heading": "9. User generated contributions", "paragraphs": ["The Services invite you to post Contributions: reading logs (shown on a book's public page with your display name), book club posts (seen by the club's members), ratings, lists you choose to share by link, and private notes and highlights. Contributions you make public may be viewable by other users of the Services and by anyone you share a link with. When you create or make available any Contributions, you thereby represent and warrant that:", "1. The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.", "2. You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.", "3. You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and these Legal Terms.", "4. Your Contributions are not false, inaccurate, or misleading.", "5. Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.", "6. Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).", "7. Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.", "8. Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.", "9. Your Contributions do not violate any applicable law, regulation, or rule.", "10. Your Contributions do not violate the privacy or publicity rights of any third party.", "11. Your Contributions do not violate any applicable law concerning child sexual abuse material, or otherwise intended to protect the health or well-being of minors.", "12. Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.", "13. Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.", "Any use of the Services in violation of the foregoing violates these Legal Terms and may result in, among other things, termination or suspension of your rights to use the Services."]}, {"heading": "10. Contribution license", "paragraphs": ["We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. The only license you give us is the one in section 33: to store, copy and display them where and to whom you posted them, so we can run the features you use.", "We are not liable for any statements or representations in your Contributions provided by you in any area on the Services. You are solely responsible for your Contributions to the Services and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.", "We have the right, in our sole and absolute discretion, to remove or hide any Contributions at any time and for any reason, without notice. We have no obligation to monitor your Contributions."]}, {"heading": "11. Guidelines for reviews", "paragraphs": ["You can rate books and write about them in reading logs. When you do, you must comply with the following criteria: (1) you should have firsthand experience with the book you're reviewing; (2) your reviews should not contain offensive profanity, or abusive, racist, offensive, or hateful language; (3) your reviews should not contain discriminatory references based on religion, race, gender, national origin, age, marital status, sexual orientation, or disability; (4) your reviews should not contain references to illegal activity; (5) you should not be affiliated with competitors if posting negative reviews; (6) you should not make any conclusions as to the legality of conduct; (7) you may not post any false or misleading statements; and (8) you may not organize a campaign encouraging others to post reviews, whether positive or negative.", "We may remove reviews in our sole discretion. We have absolutely no obligation to screen reviews or to delete reviews, even if anyone considers reviews objectionable or inaccurate. Reviews are not endorsed by us, and do not necessarily represent our opinions or the views of any of our affiliates or partners. We do not assume liability for any review or for any claims, liabilities, or losses resulting from any review. Reviews are Contributions, so you keep them, and the license you give us is the one in section 33."]}, {"heading": "12. Third-party websites and content", "paragraphs": ["The Services contain (or you may be sent via the Site) links to other websites (\"Third-Party Websites\"), such as Google Books, the Internet Archive, LibriVox and Project Gutenberg, as well as articles, photographs, text, graphics, pictures, designs, music, sound, video, information, applications, software, and other content or items belonging to or originating from third parties (\"Third-Party Content\"), such as book details and covers from Google Books and recordings from LibriVox. Such Third-Party Websites and Third-Party Content are not investigated, monitored, or checked for accuracy, appropriateness, or completeness by us, and we are not responsible for any Third-Party Websites accessed through the Services or any Third-Party Content posted on, available through, or installed from the Services, including the content, accuracy, offensiveness, opinions, reliability, privacy practices, or other policies of or contained in the Third-Party Websites or the Third-Party Content. Inclusion of, linking to, or permitting the use or installation of any Third-Party Websites or any Third-Party Content does not imply approval or endorsement thereof by us. If you decide to leave the Services and access the Third-Party Websites or to use or install any Third-Party Content, you do so at your own risk, and you should be aware these Legal Terms no longer govern. You should review the applicable terms and policies, including privacy and data gathering practices, of any website to which you navigate from the Services or relating to any applications you use or install from the Services. Any purchases you make through Third-Party Websites will be through other websites and from other companies, and we take no responsibility whatsoever in relation to such purchases which are exclusively between you and the applicable third party. You agree and acknowledge that we do not endorse the products or services offered on Third-Party Websites and you shall hold us blameless from any harm caused by your purchase of such products or services. Additionally, you shall hold us blameless from any losses sustained by you or harm caused to you relating to or resulting in any way from any Third-Party Content or any contact with Third-Party Websites."]}, {"heading": "13. Services management", "paragraphs": ["We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services."]}, {"heading": "14. Privacy policy", "paragraphs": ["We care about data privacy and security. Please review our Privacy Policy: https://www.literaryworm.com/legal/privacy. By using the Services, you agree to be bound by our Privacy Policy, which is incorporated into these Legal Terms. Please be advised the Services are hosted in the United States. If you access the Services from any other region of the world with laws or other requirements governing personal data collection, use, or disclosure that differ from applicable laws in the United States, then through your continued use of the Services, you are transferring your data to the United States, and you expressly consent to have your data transferred to and processed in the United States."]}, {"heading": "15. Copyright infringements", "paragraphs": ["We respect the intellectual property rights of others. If you believe that any material available on or through the Services infringes upon any copyright you own or control, please follow the steps on our Copyright/DMCA page (a \"Notification\"). We will tell the member who posted the material that it was removed. Please be advised that pursuant to applicable law you may be held liable for damages if you make material misrepresentations in a Notification. Thus, if you are not sure that material located on or linked to by the Services infringes your copyright, you should consider first contacting an attorney."]}, {"heading": "16. Term and termination", "paragraphs": ["These Legal Terms shall remain in full force and effect while you use the Services. You can end them at any time by deleting your account from Account. WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.", "If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your account, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress."]}, {"heading": "17. Modifications and interruptions", "paragraphs": ["We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.", "We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. Our Status page shows whether the Services are working. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services. Nothing in these Legal Terms will be construed to obligate us to maintain and support the Services or to supply any corrections, updates, or releases in connection therewith."]}, {"heading": "18. Governing law", "paragraphs": ["These Legal Terms and your use of the Services are governed by and construed in accordance with the laws of the State of Illinois applicable to agreements made and to be entirely performed within the State of Illinois, without regard to its conflict of law principles."]}, {"heading": "19. Dispute resolution", "paragraphs": ["Informal negotiations. To expedite resolution and control the cost of any dispute, controversy, or claim related to these Legal Terms (each a \"Dispute\" and collectively, the \"Disputes\") brought by either you or us (individually, a \"Party\" and collectively, the \"Parties\"), the Parties agree to first attempt to negotiate any Dispute (except those Disputes expressly provided below) informally for at least thirty (30) days before initiating arbitration. Such informal negotiations commence upon written notice from one Party to the other Party.", "Binding arbitration. If the Parties are unable to resolve a Dispute through informal negotiations, the Dispute (except those Disputes expressly excluded below) will be finally and exclusively resolved by binding arbitration. YOU UNDERSTAND THAT WITHOUT THIS PROVISION, YOU WOULD HAVE THE RIGHT TO SUE IN COURT AND HAVE A JURY TRIAL. The arbitration shall be commenced and conducted under the Commercial Arbitration Rules of the American Arbitration Association (\"AAA\") and, where appropriate, the AAA's Supplementary Procedures for Consumer Related Disputes (\"AAA Consumer Rules\"), both of which are available at the American Arbitration Association (AAA) website. Your arbitration fees and your share of arbitrator compensation shall be governed by the AAA Consumer Rules and, where appropriate, limited by the AAA Consumer Rules. The arbitration may be conducted in person, through the submission of documents, by phone, or online. The arbitrator will make a decision in writing, but need not provide a statement of reasons unless requested by either Party. The arbitrator must follow applicable law, and any award may be challenged if the arbitrator fails to do so. Except where otherwise required by the applicable AAA rules or applicable law, the arbitration will take place in Cook County, Illinois. Except as otherwise provided herein, the Parties may litigate in court to compel arbitration, stay proceedings pending arbitration, or to confirm, modify, vacate, or enter judgment on the award entered by the arbitrator.", "If for any reason, a Dispute proceeds in court rather than arbitration, the Dispute shall be commenced or prosecuted in the state and federal courts located in Cook County, Illinois, and the Parties hereby consent to, and waive all defenses of lack of personal jurisdiction, and forum non conveniens with respect to venue and jurisdiction in such state and federal courts. Application of the United Nations Convention on Contracts for the International Sale of Goods and the Uniform Computer Information Transaction Act (UCITA) are excluded from these Legal Terms.", "In no event shall any Dispute brought by either Party related in any way to the Services be commenced more than one (1) year after the cause of action arose. If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court.", "Restrictions. The Parties agree that any arbitration shall be limited to the Dispute between the Parties individually. To the full extent permitted by law, (a) no arbitration shall be joined with any other proceeding; (b) there is no right or authority for any Dispute to be arbitrated on a class-action basis or to utilize class action procedures; and (c) there is no right or authority for any Dispute to be brought in a purported representative capacity on behalf of the general public or any other persons.", "Exceptions to informal negotiations and arbitration. The Parties agree that the following Disputes are not subject to the above provisions concerning informal negotiations and binding arbitration: (a) any Disputes seeking to enforce or protect, or concerning the validity of, any of the intellectual property rights of a Party; (b) any Dispute related to, or arising from, allegations of theft, piracy, invasion of privacy, or unauthorized use; and (c) any claim for injunctive relief. If this provision is found to be illegal or unenforceable, then neither Party will elect to arbitrate any Dispute falling within that portion of this provision found to be illegal or unenforceable and such Dispute shall be decided by a court of competent jurisdiction within the courts listed for jurisdiction above, and the Parties agree to submit to the personal jurisdiction of that court."]}, {"heading": "20. Corrections", "paragraphs": ["There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice."]}, {"heading": "21. Disclaimer", "paragraphs": ["THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT (INCLUDING BOOK DETAILS FROM GOOGLE BOOKS AND SUMMARIES AND ANSWERS WRITTEN BY AI) OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE OFFERED BY A THIRD PARTY THROUGH THE SERVICES OR ANY HYPERLINKED WEBSITE, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGMENT AND EXERCISE CAUTION WHERE APPROPRIATE."]}, {"heading": "22. Limitations of liability", "paragraphs": ["IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE SIX (6) MONTH PERIOD PRIOR TO ANY CAUSE OF ACTION ARISING. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS."]}, {"heading": "23. Indemnification", "paragraphs": ["You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or arising out of: (1) your Contributions; (2) use of the Services; (3) breach of these Legal Terms; (4) any breach of your representations and warranties set forth in these Legal Terms; (5) your violation of the rights of a third party, including but not limited to intellectual property rights; or (6) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it."]}, {"heading": "24. User data", "paragraphs": ["We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services, as our Privacy Policy describes. You can download a copy of your data at any time from Account (Download my data). To the extent permitted by law, you are responsible for keeping your own copy of anything you can't afford to lose, and you agree that we shall have no liability to you for any loss or corruption of any such data."]}, {"heading": "25. Electronic communications, transactions, and signatures", "paragraphs": ["Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Services, satisfy any legal requirement that such communication be in writing. YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES. You hereby waive any rights or requirements under any statutes, regulations, rules, ordinances, or other laws in any jurisdiction which require an original signature or delivery or retention of non-electronic records, or to payments or the granting of credits by any means other than electronic means."]}, {"heading": "26. SMS text messaging", "paragraphs": ["LiteraryWorm doesn't send text messages (SMS) and doesn't ask for your phone number. If we ever start a text messaging program, we'll add its terms here, including how to opt out, before it begins."]}, {"heading": "27. California users and residents", "paragraphs": ["If any complaint with us is not satisfactorily resolved, you can contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834 or by telephone at (800) 952-5210 or (916) 445-1254."]}, {"heading": "28. Miscellaneous", "paragraphs": ["These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions. There is no joint venture, partnership, employment or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us by virtue of having drafted them. You hereby waive any and all defenses you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms."]}, {"heading": "29. Your account", "paragraphs": ["Account holders must be 18 or older. You may add profiles for people in your household, including Kids profiles with your consent, and you're responsible for how they're used.", "Keep your password private. You can change it, and delete your account, from Account at any time."]}, {"heading": "30. Membership", "paragraphs": ["Plans renew automatically each month on your billing day until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds. You can change your billing day (the 1st to the 28th), and pause and resume, from Account. Yearly plans cost ten times the monthly price, start the day you pay and renew on that date each year until you cancel; we remind you in the app 30 days before. The same 48 hours' notice applies, so cancelling later means one more yearly charge. Moving from monthly to yearly starts the year at once, with the unused part of the month taken off its price; moving a yearly plan to a bigger plan charges the difference for the rest of the year straight away, and to a smaller one takes effect at renewal with no credit. Yearly plans can't be paused or change their billing day. You can choose monthly billing at any time, and it starts on your renewal date, with nothing charged or refunded before then.", "This is not a demo app anymore: your LiteraryWorm account is a live account. You'll be billed monthly, or yearly if you choose, until you cancel. Add a payment method in Account → Plan and billing to continue your membership. On monthly billing you can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account; a yearly plan can be cancelled at any time, but not paused.", "Plan limits. Each plan includes the audiobook listening, profiles and offline devices shown on the Plans page: Basic, 5 hours a month, 1 profile and 1 device; Standard, 30 hours, 5 profiles and 10 devices; Premium, unlimited listening, 12 profiles and 24 devices. Listening is counted for the whole household on every device. When a month's hours are used up, audiobooks pause until the 1st of the next month; reading carries on, and you can change plan at any time. To move to a plan with fewer profiles or offline devices, first set aside or remove the profiles and free the devices it has no room for. A profile set aside keeps its shelf, history and settings, doesn't count towards the plan, and comes back when there's room. While a yearly membership waits to move to a smaller plan at renewal, it has that plan's room already. Each device that saves books with Read offline holds one of the plan's places: free one in Account → Plan and billing to use another device, and the freed device's offline books are removed the next time it opens LiteraryWorm.", "Staff memberships. People with a LiteraryWorm staff role (admin, editor, developer, billing, customer service, blog or sales) have a complimentary Premium membership for as long as they hold a role. It's never billed and can't be paused or cancelled; it ends when their last staff role is removed, and they can then choose a plan like any member."]}, {"heading": "31. Your licence to read and listen", "paragraphs": ["While your membership is active, we give you a personal, non-exclusive, non-transferable, revocable licence to read and listen to the books in LiteraryWorm for your own and your household's non-commercial use, in the app.", "You may not copy, sell, share, broadcast or publicly perform the books, remove or get around any protection on them, or use them to train AI models. Books saved for offline reading stay in the app on your device.", "This licence doesn't apply to public-domain works themselves, which anyone may use freely; it covers our app, our edition and our service."]}, {"heading": "32. Who owns the books and the app", "paragraphs": ["Public-domain titles: the texts come from Project Gutenberg and the recordings from LibriVox, whose volunteers release their recordings into the public domain. These works are in the public domain in the United States; they may not be everywhere, so check your country's rules before using them outside LiteraryWorm.", "Other LiteraryWorm titles show sample pages, not the published books. Book details and covers from Google Books belong to their publishers and rights holders and are shown under Google's terms.", "Summaries, Ask the book answers and Who's who are written by AI (Claude) and labelled so. They may be wrong; they're provided for your own reading and may not be republished as LiteraryWorm's.", "The LiteraryWorm name, logo, design and software belong to LiteraryWorm. Using the service doesn't give you any rights in them beyond these Terms."]}, {"heading": "33. What you post, and the license you give us", "paragraphs": ["You own what you write: reading logs, club posts, list names and descriptions, notes and highlights.", "So we can run the features you use, you give LiteraryWorm a worldwide, non-exclusive, royalty-free licence to store, copy and display what you post, only where and to whom you posted it (logs on the book's public page with your display name, club posts to the club, shared lists to anyone with the link). The licence ends when you delete the content or your account, except for copies already made by others, such as someone else's screenshot.", "Notes, highlights and private lists are never shown to anyone else."]}, {"heading": "34. Books you upload", "paragraphs": ["Upload only books you have the right to read in this way, such as DRM-free books you've bought or works in the public domain. Don't upload books you don't have rights to, and don't remove DRM to upload them.", "Your uploads stay private to the profile that added them. We store their text only to show it to you, claim no rights in them, and delete them when you do or when you delete the profile or account."]}, {"heading": "35. Rules, changes and ending", "paragraphs": ["Don't post anything unlawful, hateful, harassing or infringing, impersonate others, spam clubs, or try to break or overload the service. We may remove content that breaks these rules and suspend accounts that keep doing so, including repeat copyright infringers (see Copyright/DMCA).", "LiteraryWorm is provided as is. We'll tell you before changing these Terms in ways that matter, and you can cancel or delete your account at any time."]}, {"heading": "36. Contact us", "paragraphs": ["In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at: LiteraryWorm, support@literaryworm.com."]}]$lw$::jsonb),
  ($lw$eula$lw$, 6, $lw$End User License Agreement$lw$, $lw$LiteraryWorm is licensed to You (End-User) by LiteraryWorm ("Licensor"), for use only under the terms of this License Agreement. By using the Licensed Application at https://www.literaryworm.com, or installing it on a device from your browser, and any update to it, You agree to be bound by all of the terms and conditions of this License Agreement. It sits alongside our Terms of Service; where they cover the same thing, the Terms of Service apply.$lw$, $lw$[{"heading": "1. The application", "paragraphs": ["LiteraryWorm (\"Licensed Application\") is a piece of software created to read and listen to books online. It runs in a web browser and can be installed from the browser on phones, tablets and computers (\"Devices\"). It is used to read ebooks and listen to audiobooks, review them, and share opinions with other readers. The books we offer in full are in the public domain and have no DRM.", "The Licensed Application is not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use this Licensed Application. You may not use the Licensed Application in a way that would violate the Gramm-Leach-Bliley Act (GLBA).", "The Licensed Application isn't sold through an app store, and no app store or other third party is a party to this License Agreement. LiteraryWorm is solely responsible for the Licensed Application and its content."]}, {"heading": "2. Scope of license", "paragraphs": ["2.1 You are given a non-transferable, non-exclusive, non-sublicensable license to use the Licensed Application on any Devices that You (End-User) own or control, with the exception that people in your household may use it through the profiles on your account, as the Terms of Service allow.", "2.2 This license will also govern any updates of the Licensed Application provided by Licensor that replace, repair, and/or supplement the first Licensed Application, unless a separate license is provided for such update, in which case the terms of that new license will govern.", "2.3 You may not share or make the Licensed Application available to third parties (except through features the Licensed Application offers, such as shared lists and book clubs, or with LiteraryWorm's prior written consent), sell, rent, lend, lease or otherwise redistribute the Licensed Application.", "2.4 You may not reverse engineer, translate, disassemble, integrate, decompile, remove, modify, combine, create derivative works or updates of, adapt, or attempt to derive the source code of the Licensed Application, or any part thereof, except with LiteraryWorm's prior written consent or where the law allows it. Being able to see source code we publish doesn't give You a license to use it.", "2.5 You may not copy (excluding when expressly authorized by this license) or alter the Licensed Application or portions thereof. Books You save for offline reading are kept in the Licensed Application on that Device only. You may not remove any intellectual property notices. If you sell or give away a Device, sign out of LiteraryWorm on it first; signing out removes books you uploaded from that Device, and you can clear books saved for offline from the Licensed Application or your browser.", "2.6 Violations of the obligations mentioned above, as well as the attempt of such infringement, may be subject to prosecution and damages.", "2.7 Licensor reserves the right to modify the terms and conditions of licensing. We'll tell you before changing them in ways that matter.", "2.8 Nothing in this license should be interpreted to restrict third-party terms. When using the Licensed Application, You must ensure that You comply with applicable third-party terms and conditions."]}, {"heading": "3. Technical requirements", "paragraphs": ["3.1 The Licensed Application requires a current version of Chrome, Edge, Firefox or Safari and an internet connection, except for books saved for offline reading. Licensor recommends keeping your browser up to date.", "3.2 Licensor attempts to keep the Licensed Application updated so that it works with new versions of browsers and new hardware. You are not granted rights to claim such an update.", "3.3 You acknowledge that it is Your responsibility to confirm and determine that the Device on which You intend to use the Licensed Application satisfies the technical specifications mentioned above.", "3.4 Licensor reserves the right to modify the technical specifications as it sees appropriate at any time."]}, {"heading": "4. Maintenance and support", "paragraphs": ["4.1 The Licensor is solely responsible for providing any maintenance and support services for this Licensed Application. You can reach the Licensor at support@literaryworm.com.", "4.2 No app store or other third party has any obligation to provide maintenance and support services for the Licensed Application."]}, {"heading": "5. Use of data", "paragraphs": ["You acknowledge that Licensor stores and can access Your account, Your profiles and what You read, save and share in the Licensed Application, so that it can provide it to You, and that Licensor's use of that information is subject to Your legal agreements with Licensor and Licensor's privacy policy: https://www.literaryworm.com/legal/privacy.", "You acknowledge that the Licensor and its hosting providers may collect technical data, such as your browser type, IP address and error reports, to keep the Licensed Application secure and working and to offer product support, and a short label for each Device you're signed in on (such as \"Chrome on Windows\") so you can send a book to another Device. Licensor doesn't use this information for advertising."]}, {"heading": "6. User-generated contributions", "paragraphs": ["The Licensed Application invites you to contribute content: reading logs (shown on a book's public page with your display name), book club posts (seen by the club's members), ratings, lists you choose to share by link, and private notes and highlights (collectively, \"Contributions\"). Contributions you make public may be viewable by anyone, including through links shared outside the Licensed Application. When you create or make available any Contributions, you thereby represent and warrant that:", "1. The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.", "2. You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Licensed Application, and other users of the Licensed Application to use your Contributions in any manner contemplated by the Licensed Application and this License Agreement.", "3. You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Licensed Application and this License Agreement.", "4. Your Contributions are not false, inaccurate, or misleading.", "5. Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.", "6. Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).", "7. Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.", "8. Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.", "9. Your Contributions do not violate any applicable law, regulation, or rule.", "10. Your Contributions do not violate the privacy or publicity rights of any third party.", "11. Your Contributions do not violate any applicable law concerning child sexual abuse material, or otherwise intended to protect the health or well-being of minors.", "12. Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.", "13. Your Contributions do not otherwise violate, or link to material that violates, any provision of this License Agreement, or any applicable law or regulation.", "Any use of the Licensed Application in violation of the foregoing violates this License Agreement and may result in, among other things, termination or suspension of your rights to use the Licensed Application."]}, {"heading": "7. Contribution license", "paragraphs": ["You own your Contributions. By posting them, you give LiteraryWorm the license described in the Terms of Service (\"What you post, and the licence you give us\"): a worldwide, non-exclusive, royalty-free license to store, copy and display your Contributions, only where and to whom you posted them, so we can run the features you use. The license ends when you delete the Contribution or your account, except for copies already made by others. Notes, highlights and private lists are never shown to anyone else.", "We are not liable for any statements or representations in your Contributions. You are solely responsible for your Contributions to the Licensed Application and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.", "We may remove Contributions that break this License Agreement or the Terms of Service, at any time and without notice. We have no obligation to monitor your Contributions."]}, {"heading": "8. Liability", "paragraphs": ["8.1 Licensor's responsibility in the case of violation of obligations and tort shall be limited to intent and gross negligence. Only in case of a breach of essential contractual duties (cardinal obligations), Licensor shall also be liable in case of slight negligence. In any case, liability shall be limited to the foreseeable, contractually typical damages. The limitation mentioned above does not apply to injuries to life, limb, or health.", "8.2 Licensor takes no accountability or responsibility for any damages caused due to a breach of duties according to Section 2 of this License Agreement. To avoid data loss, You can download a copy of your data at any time from Account (Download my data). You are aware that in case of alterations or manipulations of the Licensed Application, You may not have access to the Licensed Application."]}, {"heading": "9. Warranty", "paragraphs": ["9.1 Licensor warrants that the Licensed Application is free of spyware, trojan horses, viruses, or any other malware at the time You use it. Licensor warrants that the Licensed Application works as described in Help.", "9.2 No warranty is provided for the Licensed Application that is not executable on the Device, that has been unauthorizedly modified, handled inappropriately or culpably, combined or installed with inappropriate hardware or software, used with inappropriate accessories, regardless if by Yourself or by third parties, or if there are any other reasons outside of LiteraryWorm's sphere of influence that affect the executability of the Licensed Application.", "9.3 Please notify LiteraryWorm about issues You discover without delay by email at support@literaryworm.com. The defect report will be taken into consideration and further investigated if it has been emailed within a period of seven (7) days after discovery.", "9.4 If we confirm that the Licensed Application is defective, LiteraryWorm reserves a choice to remedy the situation either by means of solving the defect or substitute delivery.", "9.5 Payments for LiteraryWorm memberships are non-refundable, as our Return Policy explains (https://www.literaryworm.com/legal/returns).", "9.6 If the user is an entrepreneur, any claim based on faults expires after a statutory period of limitation amounting to twelve (12) months after the Licensed Application was made available to the user. The statutory periods of limitation given by law apply for users who are consumers."]}, {"heading": "10. Product claims", "paragraphs": ["LiteraryWorm is responsible for addressing any claims of the End-User or any third party relating to the Licensed Application or the End-User's possession and/or use of that Licensed Application, including, but not limited to: (i) product liability claims; (ii) any claim that the Licensed Application fails to conform to any applicable legal or regulatory requirement; and (iii) claims arising under consumer protection, privacy, or similar legislation."]}, {"heading": "11. Legal compliance", "paragraphs": ["You represent and warrant that You are not located in a country that is subject to a US Government embargo, or that has been designated by the US Government as a \"terrorist supporting\" country; and that You are not listed on any US Government list of prohibited or restricted parties."]}, {"heading": "12. Contact information", "paragraphs": ["For general inquiries, complaints, questions or claims concerning the Licensed Application, please email support@literaryworm.com."]}, {"heading": "13. Termination", "paragraphs": ["The license is valid until terminated by LiteraryWorm or by You. You can end it at any time by deleting your account from Account. Your rights under this license will terminate automatically and without notice from LiteraryWorm if You fail to adhere to any term(s) of this license. Upon License termination, You shall stop all use of the Licensed Application, and remove it and any books saved for offline reading from Your Devices."]}, {"heading": "14. Third-party terms of agreements", "paragraphs": ["LiteraryWorm represents and warrants that LiteraryWorm will comply with applicable third-party terms of agreement when using the Licensed Application, including those of the services it relies on: Supabase, Vercel, Mailgun, Anthropic, Google Books, the Internet Archive, LibriVox and Project Gutenberg."]}, {"heading": "15. Intellectual property rights", "paragraphs": ["LiteraryWorm and the End-User acknowledge that, in the event of any third-party claim that the Licensed Application or the End-User's possession and use of that Licensed Application infringes on the third party's intellectual property rights, LiteraryWorm will be solely responsible for the investigation, defense, settlement, and discharge of any such intellectual property infringement claims. Who owns the books and the app is set out in the Terms of Service."]}, {"heading": "16. Applicable law", "paragraphs": ["This License Agreement is governed by the laws of the State of Illinois excluding its conflicts of law rules."]}, {"heading": "17. Miscellaneous", "paragraphs": ["17.1 If any of the terms of this agreement should be or become invalid, the validity of the remaining provisions shall not be affected. Invalid terms will be replaced by valid ones formulated in a way that will achieve the primary purpose.", "17.2 Collateral agreements, changes and amendments are only valid if laid down in writing. The preceding clause can only be waived in writing."]}]$lw$::jsonb),
  ($lw$acceptable-use$lw$, 7, $lw$Acceptable Use Policy$lw$, $lw$This Acceptable Use Policy ("Policy") is part of our Terms of Service ("Legal Terms") and should therefore be read alongside our main Legal Terms: https://www.literaryworm.com/legal/terms. It sets out what you may and may not do on LiteraryWorm, what you may post, how to use our AI features responsibly, and how to report anything that breaks it.$lw$, $lw$[{"heading": "Agreement to this policy", "paragraphs": ["When you use the AI-powered services provided by LiteraryWorm (\"AI Products\"), you warrant that you will comply with this document, our Legal Terms and all applicable laws and regulations governing AI. Our AI Products are the book summaries, Ask the book and Who's who, which are written by Claude, an AI model made by Anthropic, and labelled as written by AI. Your usage of our AI Products signifies your agreement to engage with our platform in a lawful, ethical, and responsible manner that respects the rights and dignity of all individuals. If you do not agree with these Legal Terms, please refrain from using our Services. Your continued use of our Services implies acceptance of these Legal Terms.", "Please carefully review this Policy which applies to any and all:", "(a) uses of our Services (as defined in \"Legal Terms\");", "(b) forms, materials, consent tools, comments, posts, and all other content available on the Services (\"Content\");", "(c) material which you contribute to the Services, including any upload, post, reading log, rating, book club post, shared list or comment (\"Contribution\");", "(d) responsible implementation and management of AI Products within our Services."]}, {"heading": "Who we are", "paragraphs": ["We are LiteraryWorm (\"Company,\" \"we,\" \"us,\" or \"our\"). We operate the website https://www.literaryworm.com (the \"Site\"), as well as any other related products and services that refer or link to this Policy (collectively, the \"Services\")."]}, {"heading": "Use of the Services", "paragraphs": ["When you use the Services, you warrant that you will comply with this Policy and with all applicable laws.", "You also acknowledge that you may not:", "1. Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.", "2. Make any unauthorized use of the Services, including collecting display names and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.", "3. Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein, such as profile PINs, daily reading limits and age ratings.", "4. Engage in unauthorized framing of or linking to the Services.", "5. Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.", "6. Make improper use of our Services, including our support services, or submit false reports of abuse or misconduct.", "7. Engage in any automated use of the Services, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.", "8. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.", "9. Attempt to impersonate another user or person or use the display name of another user.", "10. Use any information obtained from the Services in order to harass, abuse, or harm another person.", "11. Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.", "12. Decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services, except as expressly permitted by applicable law.", "13. Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.", "14. Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.", "15. Delete the copyright or other proprietary rights notice from any Content.", "16. Copy or adapt the Services' software, including but not limited to HTML, JavaScript, or other code.", "17. Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.", "18. Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats (\"gifs\"), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as \"spyware\" or \"passive collection mechanisms\" or \"pcms\").", "19. Except as may be the result of standard search engine or Internet browser usage, or the Services' own Read offline feature, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.", "20. Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.", "21. Use the Services in a manner inconsistent with any applicable laws or regulations.", "22. Use a buying agent or purchasing agent to make purchases on the Services.", "23. Sell or otherwise transfer your account or a profile."]}, {"heading": "Subscriptions", "paragraphs": ["If you subscribe to our Services, you understand, acknowledge, and agree that you may not, except if expressly permitted:", "1. Engage in any use, including modification, copying, redistribution, publication, display, performance, or retransmission, of any portions of any Services, other than as expressly permitted by this Policy, without the prior written consent of LiteraryWorm, which consent LiteraryWorm may grant or refuse in its sole and absolute discretion.", "2. Reconstruct or attempt to discover any source code or algorithms of the Services, or any portion thereof, by any means whatsoever. Being able to see source code we publish doesn't give you a license to use it.", "3. Provide, or otherwise make available, the Services to any third party, other than the people in your household who use the profiles on your account.", "4. Intercept any data not intended for you.", "5. Damage, reveal, or alter any user's data, or any other hardware, software, or information relating to another person or entity."]}, {"heading": "AI Products", "paragraphs": ["When you use the AI Products provided by LiteraryWorm, you warrant that you will not:", "1. Try to make the AI Products produce content that this Policy forbids, or that breaks Anthropic's usage policies.", "2. Deploy AI techniques that utilize subliminal, manipulative, or deceptive methods designed to distort behavior and impair informed decision-making, particularly when such actions cause significant harm to individuals.", "3. Exploit vulnerabilities related to age, disability, or socio-economic circumstances through AI in a way that distorts behavior or decision-making, especially if this results in significant harm to the individual.", "4. Use AI systems for biometric categorization that infer sensitive attributes such as race, political opinions, trade union membership, religious or philosophical beliefs, sex life, or sexual orientation, except in limited cases, such as labeling or filtering lawfully acquired datasets, or specific law enforcement activities.", "5. Implement AI-based social scoring systems that evaluate or classify individuals or groups based on their social behavior or personal traits in a manner that causes harm, discrimination, or unfair treatment.", "6. Assess the risk of an individual committing criminal offenses based solely on profiling, personality traits, or other non-behavioral factors, except in narrowly defined circumstances where legal safeguards are in place.", "7. Compile facial recognition databases through untargeted scraping of facial images from the internet, social media, or CCTV footage, unless it is part of a legally compliant and narrowly defined purpose.", "8. Use AI to infer emotions in sensitive environments such as workplaces, educational institutions, or any other context where such analysis could lead to discrimination, unfair treatment, or privacy violations.", "9. Engage in real-time remote biometric identification in public places for law enforcement purposes, except in specific situations where there are strong legal justifications and oversight mechanisms."]}, {"heading": "Artificial intelligence", "paragraphs": ["We recognize the significant impact AI can have on our users and society, and we are dedicated to ensuring that our AI Products are designed and operated in a manner that aligns with comprehensive ethical standards. We aim to use AI to enhance user experiences while upholding fairness, transparency, and accountability principles. That's why everything our AI Products write is labelled as written by AI, and why Ask the book and Who's who are only given the text up to your place in the book.", "This Policy applies to all AI-powered features, services, and systems in our Services. It governs the development, deployment, and use of AI technologies to protect users' rights and maintain transparency in all AI operations. This Policy applies to all stakeholders, including employees, third-party vendors, and partners who contribute to or interact with our AI Products.", "Enforcement. Any misuse of our AI Products or failure to adhere to the standards outlined in this Policy will result in appropriate actions to ensure the integrity of our platform and the protection of our users. The specific consequences for misuse of AI may vary depending on the nature and severity of the violation and the user's history with our Services.", "Violations may include, but are not limited to:", "1. Engaging the AI Products in ways that violate user privacy, manipulate data, disregard ethical guidelines, or are against AI service providers' terms of use (for our AI Products, Anthropic's).", "2. Deploying AI in a manner that introduces or causes bias, leading to unfair treatment of users or groups.", "3. Improper handling, storage, or use of data by AI Products, leading to breaches of user trust and legal compliance.", "4. Using AI in a way that compromises the privacy and security of our systems, data, or users.", "Depending on the violation, LiteraryWorm may take one or more of the following actions:", "Warnings: The responsible party may receive a formal warning and be required to cease violating practices.", "Temporary Suspension: In cases of repeated or more severe violations, the responsible individual's access to AI Products or certain features of our platform may be temporarily suspended while the issue is investigated.", "Termination of Access: Serious violations, particularly those that result in harm to users or breach privacy or other regulations, may lead to the permanent termination of access to our AI Products and Services.", "Legal Action: In cases where the misuse of AI leads to significant harm, data breaches, or legal violations, we may pursue legal action against the party responsible. This could include reporting the incident to law enforcement or regulatory bodies.", "Public Disclosure: For incidents that impact public trust or involve severe ethical breaches, we reserve the right to publicly disclose the violation and the actions taken in response to maintain transparency and accountability.", "Commitment to Responsible AI. In addition to the consequences outlined above, we are deeply committed to repairing any harm caused by the misuse of AI. This commitment is a testament to our dedication to our users and our responsibility as a company. We will correct biased outcomes and implement additional safeguards to prevent future violations.", "At LiteraryWorm, we are committed to the ongoing refinement and enhancement of our Policy. As technology evolves and regulatory environments shift, we recognize the importance of keeping our policies up to date to ensure that they remain relevant, effective, and aligned with best practices in AI ethics. We will regularly review and update our Policy to reflect technological advancements and legal changes in local, national, and international regulations related to AI. Our Policy will be updated as needed to comply with new laws and guidelines, ensuring that our practices remain legally sound and socially responsible."]}, {"heading": "Contributions", "paragraphs": ["In this Policy, the term \"Contributions\" means: any data, information, text, messages or other materials that you post, share, upload, submit, or otherwise provide in any manner on or through the Services, such as reading logs, ratings, book club posts, list names and descriptions, notes and highlights, and books you upload; or any other content, materials, or data you provide to LiteraryWorm or use with the Services.", "Some areas of the Services allow users to upload, transmit, or post Contributions. We may but are under no obligation to review or moderate the Contributions made on the Services, and we expressly exclude our liability for any loss or damage resulting from any of our users' breach of this Policy. Please report any Contribution that you believe breaches this Policy; however, we will determine, in our sole discretion, whether a Contribution is indeed in breach of this Policy.", "You warrant that:", "1. you are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and this Policy;", "2. all your Contributions comply with applicable laws and are original and true (if they represent your opinion or facts);", "3. the creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party; and", "4. you have the verifiable consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and this Policy.", "You also agree that you will not post, transmit, or upload any (or any part of a) Contribution that:", "1. is in breach of applicable laws, regulation, court order, contractual obligation, this Policy, our Legal Terms, a legal duty, or that promotes or facilitates fraud or illegal activities;", "2. is defamatory, obscene, offensive, hateful, insulting, intimidating, bullying, abusive, or threatening, to any person or group;", "3. is false, inaccurate, or misleading;", "4. includes child sexual abuse material, or violates any applicable law intended to protect minors;", "5. contains any material that solicits personal information from anyone under the age of 18 or exploits people under the age of 18 in a sexual or violent manner;", "6. promotes violence, advocates the violent overthrow of any government, or incites, encourages, or threatens physical harm against another;", "7. is obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, contains sexually explicit material, or is otherwise objectionable (as determined by us);", "8. is discriminatory based on race, sex, religion, nationality, disability, sexual orientation, or age;", "9. bullies, intimidates, humiliates, or insults any person;", "10. promotes, facilitates, or assists anyone in promoting and facilitating acts of terrorism;", "11. infringes, or assists anyone in infringing, a third party's intellectual property rights or publicity or privacy rights;", "12. is deceitful, misrepresents your identity or affiliation with any person and/or misleads anyone as to your relationship with us or implies that the Contribution was made by someone else than you;", "13. contains unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation that has been \"paid for,\" whether with monetary compensation or in kind; or", "14. misrepresents your identity or who the Contribution is from."]}, {"heading": "Reviews and ratings", "paragraphs": ["When your Contribution is a review or rating of a book, such as a rating or a reading log, you also agree that:", "1. you have firsthand experience with the book being reviewed;", "2. your Contribution is true to your experience;", "3. you are not affiliated with competitors if posting negative reviews (or linked in any way to, e.g., by being the author or publisher of, a book if posting positive reviews);", "4. you cannot make or offer any conclusions as to the legality of conduct;", "5. you cannot post any false or misleading statements; and", "6. you do not and will not organize a campaign encouraging others to post reviews, whether positive or negative."]}, {"heading": "Reporting a breach of this policy", "paragraphs": ["We may but are under no obligation to review or moderate the Contributions made on the Services and we expressly exclude our liability for any loss or damage resulting from any of our users' breach of this Policy.", "If you consider that any Service, Content, or Contribution breaches this Policy, please email us at report@literaryworm.com to let us know which Service, Content, or Contribution is in breach of this Policy and why.", "If you consider that any Service, Content, or Contribution infringes any third-party intellectual property rights, please email us at report@literaryworm.com. For a formal notice under the Digital Millennium Copyright Act, follow the steps on our Copyright/DMCA page.", "You can also send detailed feedback on your interactions with our AI Products by emailing report@literaryworm.com. Please include specific details about the AI interaction, such as the book, the context, the nature of the concern, and any relevant screenshots or documentation.", "We will reasonably determine whether a Service, Content, or Contribution breaches this Policy."]}, {"heading": "Consequences of breaching this policy", "paragraphs": ["The consequences for violating our Policy will vary depending on the severity of the breach and the user's history on the Services, by way of example:", "We may, in some cases, give you a warning and/or remove the infringing Contribution, however, if your breach is serious or if you continue to breach our Legal Terms and this Policy, we have the right to suspend or terminate your access to and use of our Services and, if applicable, disable your account. We may also notify law enforcement or issue legal proceedings against you when we believe that there is a genuine risk to an individual or a threat to public safety.", "We exclude our liability for all action we may take in response to any of your breaches of this Policy."]}, {"heading": "Complaints and removal of legitimate content", "paragraphs": ["If you consider that some Content or Contribution has been mistakenly removed or blocked from the Services, please email us at report@literaryworm.com and we will promptly review our decision to remove such Content or Contribution. The Content or Contribution may stay \"down\" whilst we conduct the review process. If it was removed after a copyright notice, you can also send a counter-notice, as our Copyright/DMCA page explains."]}, {"heading": "Disclaimer", "paragraphs": ["LiteraryWorm is under no obligation to monitor users' activities, and we disclaim any responsibility for any user's misuse of the Services. LiteraryWorm has no responsibility for any user or other Content or Contribution created, maintained, stored, transmitted, or accessible on or through the Services, and is not obligated to monitor or exercise any editorial control over such material. If LiteraryWorm becomes aware that any such Content or Contribution violates this Policy, LiteraryWorm may, in addition to removing such Content or Contribution and blocking your account, report such breach to the police or appropriate regulatory authority. Unless otherwise stated in this Policy, LiteraryWorm disclaims any obligation to any person who has not entered into an agreement with LiteraryWorm for the use of the Services."]}, {"heading": "How can you contact us about this policy?", "paragraphs": ["If you have any further questions or comments or wish to report any problematic Content or Contribution, you may contact us by email: report@literaryworm.com."]}]$lw$::jsonb),
  ($lw$returns$lw$, 8, $lw$Return Policy$lw$, $lw$How refunds work for LiteraryWorm memberships, and who to contact with questions.$lw$, $lw$[{"heading": "Refunds", "paragraphs": ["This is not a demo app anymore: your LiteraryWorm account is a live account. You'll be billed monthly, or yearly if you choose, until you cancel. Add a payment method in Account → Plan and billing to continue your membership. On monthly billing you can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account; a yearly plan can be cancelled at any time, but not paused.", "All sales are final and no refund will be issued. You can cancel at any time from Account. Cancel at least 48 hours before your next billing date and your plan stays active until the end of the period you've paid for, and you won't be charged again. If you cancel less than 48 hours before your billing date, that charge still goes through (it isn't refunded) and your plan ends at the end of the month it pays for. You can also pause your membership, which stops billing until you resume.", "Gift memberships are paid once and are final too. A gift code doesn't expire, works once (from the day the gift starts, if the buyer chose a later day up to a year ahead; if the buyer asked us to email it to the person it's for, we send it once it can be redeemed, and otherwise we remind the buyer three days before a later start), and can't be exchanged for cash or refunded. Redeeming one gives its months free on the gift's plan; when they end, the membership ends unless a card has been added, and then it renews monthly until you cancel.", "This doesn't affect any rights you have under the law where you live."]}, {"heading": "Questions", "paragraphs": ["If you have any questions concerning our return policy, please contact us at support@literaryworm.com."]}]$lw$::jsonb),
  ($lw$copyright$lw$, 9, $lw$Copyright/DMCA$lw$, $lw$How LiteraryWorm respects copyright, which works are in the public domain, and how a rights holder can report content they believe infringes, under the Digital Millennium Copyright Act (DMCA).$lw$, $lw$[{"heading": "Our books and their licences", "paragraphs": ["Public-domain titles use texts from Project Gutenberg and recordings from LibriVox, which LibriVox volunteers release into the public domain. These works are in the public domain in the United States, where LiteraryWorm operates. Our copies leave out Project Gutenberg's own header, footer and licence text.", "Other titles show sample pages written for LiteraryWorm, not the published books, and book details and covers come from Google Books under Google's terms.", "If you believe any of this is wrong, for example that a work isn't in the public domain, tell us using the steps below and we'll look into it promptly."]}, {"heading": "What people post or upload", "paragraphs": ["Reading logs, club posts and shared lists are written by members, who keep their rights in them. Books members upload are private to their own profile and aren't shown to anyone else; members must have the right to read them that way (see the Terms of Service)."]}, {"heading": "Reporting content", "paragraphs": ["Users can report user-generated content and copyright infringement, and get information about the Acceptable Use Policy, by emailing report@literaryworm.com."]}, {"heading": "Reporting infringement", "paragraphs": ["If you believe something on LiteraryWorm infringes your copyright, send our designated agent a written notice that includes: your physical or electronic signature; the work you believe is infringed; the material on LiteraryWorm you want removed and where it is (a link helps); your name, address, phone number and email; a statement that you believe in good faith the use isn't authorised by the copyright owner, its agent or the law; and a statement, under penalty of perjury, that the notice is accurate and that you are, or are authorised to act for, the owner.", "Our designated agent's name, postal address, phone number and email, as registered with the U.S. Copyright Office, will be listed here before launch.", "We remove or disable access to the material, tell the member who posted it, and keep a record of the notice."]}, {"heading": "Counter-notices", "paragraphs": ["If your content was removed and you believe that was a mistake or that you had the right to post it, you may send a counter-notice with: your signature; what was removed and where it was; a statement, under penalty of perjury, that you believe in good faith it was removed by mistake or misidentification; your name, address and phone number; and your consent to the jurisdiction of the federal court for your address (or, outside the United States, any district where LiteraryWorm may be found) and to accept service from the person who sent the notice.", "We forward it to the person who sent the notice and may restore the content in 10 to 14 business days unless they tell us they've filed a court action."]}, {"heading": "Repeat infringers and false claims", "paragraphs": ["We close the accounts of members who repeatedly infringe copyright.", "Knowingly misrepresenting that material infringes, or that it was removed by mistake, can make you liable for damages under the DMCA, so please be sure before you send a notice or counter-notice."]}]$lw$::jsonb),
  ($lw$disclaimer$lw$, 10, $lw$Disclaimer$lw$, $lw$The information provided by LiteraryWorm ("we," "us," or "our") on https://www.literaryworm.com (the "Site") is for general informational purposes only. This page explains what we can and can't promise about it, and about the other websites the Site links to.$lw$, $lw$[{"heading": "Website disclaimer", "paragraphs": ["All information on the Site is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site. This includes book details and covers from Google Books, and summaries and answers written by AI, which are labelled as such.", "UNDER NO CIRCUMSTANCE SHALL WE HAVE ANY LIABILITY TO YOU FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF THE SITE OR RELIANCE ON ANY INFORMATION PROVIDED ON THE SITE. YOUR USE OF THE SITE AND YOUR RELIANCE ON ANY INFORMATION ON THE SITE IS SOLELY AT YOUR OWN RISK."]}, {"heading": "External links disclaimer", "paragraphs": ["The Site may contain (or you may be sent through the Site) links to other websites or content belonging to or originating from third parties, such as Google Books, the Internet Archive, LibriVox and Project Gutenberg. The Site doesn't show advertising. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.", "WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES LINKED THROUGH THE SITE. WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES."]}, {"heading": "Testimonials disclaimer", "paragraphs": ["The Site doesn't show testimonials at the moment. Reading logs and book club posts are written by members and belong to them; they don't reflect our views and opinions.", "If we add testimonials by users of our products and/or services, they will reflect the real-life experiences and opinions of such users. However, the experiences are personal to those particular users, and may not necessarily be representative of all users of our products and/or services. We do not claim, and you should not assume, that all users will have the same experiences. YOUR INDIVIDUAL RESULTS MAY VARY.", "Testimonials will be reviewed by us before being posted, and will appear on the Site verbatim as given by the users, except for the correction of grammar or typing errors. Some testimonials may be shortened for the sake of brevity where the full testimonial contained extraneous information not relevant to the general public.", "The views and opinions contained in testimonials belong solely to the individual user and do not reflect our views and opinions. Users will not be paid or otherwise compensated for their testimonials, and we'll say so if anyone who gives one is connected to us."]}]$lw$::jsonb),
  ($lw$help$lw$, 11, $lw$Help$lw$, $lw$Answers to common questions about reading, listening, your library and your account, and how to report a problem.$lw$, $lw$[{"heading": "Where do the books come from?", "paragraphs": ["LiteraryWorm uses the Google Books API to show book details and covers when you browse and search, so you can find almost any book, save it to your library and write about it.", "The books you can read and listen to in full are public-domain classics: texts from Project Gutenberg and recordings from LibriVox. Other LiteraryWorm titles show sample pages."]}, {"heading": "Can I read my own books?", "paragraphs": ["Yes. In My Library → Uploads, add an EPUB you own that has no DRM. For example, buy a book that the publisher sells DRM-free on Google Play Books, download its EPUB from your Google Play Books library, then upload it to LiteraryWorm. Many publishers and stores sell DRM-free books, and public-domain EPUBs are free from Project Gutenberg and Standard Ebooks.", "Your upload opens in the reader with your place, bookmarks and highlights, and once you've opened it on a device, it keeps working there if your connection drops. Books with DRM can't be uploaded, and removing DRM to upload a book isn't allowed (see the Terms of Service)."]}, {"heading": "Reading and listening", "paragraphs": ["Open a book from its page with Read or Listen. Your place is shared between the two and across your devices. The mini-player keeps a book playing while you browse, and its controls also work from your lock screen and headphones.", "To read or listen without a connection, choose Read offline on a public-domain book's page."]}, {"heading": "Your account and household", "paragraphs": ["Each person at home can have their own profile, with its own library and recommendations. Lock a profile with a PIN, set daily limits for younger readers, and change your plan, password or emails in Account. You can cancel or pause online at any time.", "Your plan includes some hours of audiobooks a month for the household (Premium has no limit) and a number of devices that can keep books offline. Account → Plan and billing shows how much you've used this month and which devices hold offline places, and lets you free one."]}, {"heading": "Report a problem", "paragraphs": ["Tell us what you were doing, the page you were on, and your device and browser, by email to support@literaryworm.com."]}]$lw$::jsonb),
  ($lw$status$lw$, 12, $lw$Status$lw$, $lw$All systems are working normally.$lw$, $lw$[{"heading": "Services", "paragraphs": ["Website and app: working normally.", "Accounts, libraries and reading progress: working normally.", "Book search and details (Google Books): working normally.", "Audiobook recordings (Internet Archive): working normally.", "Summaries, Ask the book and Who's who (AI): working normally."]}, {"heading": "If something isn't working", "paragraphs": ["Your reading progress is saved on your device first and sent when the connection returns, so you won't lose your place. Books saved for offline keep working without a connection."]}]$lw$::jsonb)
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

-- =============================================================================
-- 20261029000100_legal_disclaimer.sql
-- =============================================================================
-- The Disclaimer page (from the app's built-in copy, src/data/legalPages.json), after Copyright.
-- A fresh database already has it from the seed; this adds it to one seeded before it existed.

insert into public.legal_pages (slug, position, title, summary, sections) values
  ($lw$disclaimer$lw$, 7, $lw$Disclaimer$lw$, $lw$The information provided by LiteraryWorm ("we," "us," or "our") on https://www.literaryworm.com (the "Site") is for general informational purposes only. This page explains what we can and can't promise about it, and about the other websites the Site links to.$lw$, $lw$[{"heading": "Website disclaimer", "paragraphs": ["All information on the Site is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the Site. This includes book details and covers from Google Books, and summaries and answers written by AI, which are labelled as such.", "UNDER NO CIRCUMSTANCE SHALL WE HAVE ANY LIABILITY TO YOU FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF THE SITE OR RELIANCE ON ANY INFORMATION PROVIDED ON THE SITE. YOUR USE OF THE SITE AND YOUR RELIANCE ON ANY INFORMATION ON THE SITE IS SOLELY AT YOUR OWN RISK."]}, {"heading": "External links disclaimer", "paragraphs": ["The Site may contain (or you may be sent through the Site) links to other websites or content belonging to or originating from third parties, such as Google Books, the Internet Archive, LibriVox and Project Gutenberg. The Site doesn't show advertising. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.", "WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR THE ACCURACY OR RELIABILITY OF ANY INFORMATION OFFERED BY THIRD-PARTY WEBSITES LINKED THROUGH THE SITE. WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES."]}, {"heading": "Testimonials disclaimer", "paragraphs": ["The Site doesn't show testimonials at the moment. Reading logs and book club posts are written by members and belong to them; they don't reflect our views and opinions.", "If we add testimonials by users of our products and/or services, they will reflect the real-life experiences and opinions of such users. However, the experiences are personal to those particular users, and may not necessarily be representative of all users of our products and/or services. We do not claim, and you should not assume, that all users will have the same experiences. YOUR INDIVIDUAL RESULTS MAY VARY.", "Testimonials will be reviewed by us before being posted, and will appear on the Site verbatim as given by the users, except for the correction of grammar or typing errors. Some testimonials may be shortened for the sake of brevity where the full testimonial contained extraneous information not relevant to the general public.", "The views and opinions contained in testimonials belong solely to the individual user and do not reflect our views and opinions. Users will not be paid or otherwise compensated for their testimonials, and we'll say so if anyone who gives one is connected to us."]}]$lw$::jsonb)
on conflict (slug) do nothing;

-- The pages after it move down one place.
update public.legal_pages p set position = v.position
from (values
  ($lw$help$lw$, 8),
  ($lw$status$lw$, 9)
) as v (slug, position)
where p.slug = v.slug;

-- =============================================================================
-- 20261029000200_legal_eula.sql
-- =============================================================================
-- The End User License Agreement (from the app's built-in copy, src/data/legalPages.json), after the Terms of Service.
-- A fresh database already has it from the seed; this adds it to one seeded before it existed.

-- The pages after it move down one place first, so no two pages share a position.
update public.legal_pages p set position = v.position
from (values
  ($lw$copyright$lw$, 7),
  ($lw$disclaimer$lw$, 8),
  ($lw$help$lw$, 9),
  ($lw$status$lw$, 10)
) as v (slug, position)
where p.slug = v.slug;

insert into public.legal_pages (slug, position, title, summary, sections) values
  ($lw$eula$lw$, 6, $lw$End User License Agreement$lw$, $lw$LiteraryWorm is licensed to You (End-User) by LiteraryWorm ("Licensor"), for use only under the terms of this License Agreement. By using the Licensed Application at https://www.literaryworm.com, or installing it on a device from your browser, and any update to it, You agree to be bound by all of the terms and conditions of this License Agreement. It sits alongside our Terms of Service; where they cover the same thing, the Terms of Service apply.$lw$, $lw$[{"heading": "1. The application", "paragraphs": ["LiteraryWorm (\"Licensed Application\") is a piece of software created to read and listen to books online. It runs in a web browser and can be installed from the browser on phones, tablets and computers (\"Devices\"). It is used to read ebooks and listen to audiobooks, review them, and share opinions with other readers. The books we offer in full are in the public domain and have no DRM.", "The Licensed Application is not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use this Licensed Application. You may not use the Licensed Application in a way that would violate the Gramm-Leach-Bliley Act (GLBA).", "The Licensed Application isn't sold through an app store, and no app store or other third party is a party to this License Agreement. LiteraryWorm is solely responsible for the Licensed Application and its content."]}, {"heading": "2. Scope of license", "paragraphs": ["2.1 You are given a non-transferable, non-exclusive, non-sublicensable license to use the Licensed Application on any Devices that You (End-User) own or control, with the exception that people in your household may use it through the profiles on your account, as the Terms of Service allow.", "2.2 This license will also govern any updates of the Licensed Application provided by Licensor that replace, repair, and/or supplement the first Licensed Application, unless a separate license is provided for such update, in which case the terms of that new license will govern.", "2.3 You may not share or make the Licensed Application available to third parties (except through features the Licensed Application offers, such as shared lists and book clubs, or with LiteraryWorm's prior written consent), sell, rent, lend, lease or otherwise redistribute the Licensed Application.", "2.4 You may not reverse engineer, translate, disassemble, integrate, decompile, remove, modify, combine, create derivative works or updates of, adapt, or attempt to derive the source code of the Licensed Application, or any part thereof, except with LiteraryWorm's prior written consent or where the law allows it. Being able to see source code we publish doesn't give You a license to use it.", "2.5 You may not copy (excluding when expressly authorized by this license) or alter the Licensed Application or portions thereof. Books You save for offline reading are kept in the Licensed Application on that Device only. You may not remove any intellectual property notices. If you sell or give away a Device, sign out of LiteraryWorm on it first; signing out removes books you uploaded from that Device, and you can clear books saved for offline from the Licensed Application or your browser.", "2.6 Violations of the obligations mentioned above, as well as the attempt of such infringement, may be subject to prosecution and damages.", "2.7 Licensor reserves the right to modify the terms and conditions of licensing. We'll tell you before changing them in ways that matter.", "2.8 Nothing in this license should be interpreted to restrict third-party terms. When using the Licensed Application, You must ensure that You comply with applicable third-party terms and conditions."]}, {"heading": "3. Technical requirements", "paragraphs": ["3.1 The Licensed Application requires a current version of Chrome, Edge, Firefox or Safari and an internet connection, except for books saved for offline reading. Licensor recommends keeping your browser up to date.", "3.2 Licensor attempts to keep the Licensed Application updated so that it works with new versions of browsers and new hardware. You are not granted rights to claim such an update.", "3.3 You acknowledge that it is Your responsibility to confirm and determine that the Device on which You intend to use the Licensed Application satisfies the technical specifications mentioned above.", "3.4 Licensor reserves the right to modify the technical specifications as it sees appropriate at any time."]}, {"heading": "4. Maintenance and support", "paragraphs": ["4.1 The Licensor is solely responsible for providing any maintenance and support services for this Licensed Application. You can reach the Licensor at support@literaryworm.com.", "4.2 No app store or other third party has any obligation to provide maintenance and support services for the Licensed Application."]}, {"heading": "5. Use of data", "paragraphs": ["You acknowledge that Licensor stores and can access Your account, Your profiles and what You read, save and share in the Licensed Application, so that it can provide it to You, and that Licensor's use of that information is subject to Your legal agreements with Licensor and Licensor's privacy policy: https://www.literaryworm.com/legal/privacy.", "You acknowledge that the Licensor and its hosting providers may collect technical data, such as your browser type, IP address and error reports, to keep the Licensed Application secure and working and to offer product support, and a short label for each Device you're signed in on (such as \"Chrome on Windows\") so you can send a book to another Device. Licensor doesn't use this information for advertising."]}, {"heading": "6. User-generated contributions", "paragraphs": ["The Licensed Application invites you to contribute content: reading logs (shown on a book's public page with your display name), book club posts (seen by the club's members), ratings, lists you choose to share by link, and private notes and highlights (collectively, \"Contributions\"). Contributions you make public may be viewable by anyone, including through links shared outside the Licensed Application. When you create or make available any Contributions, you thereby represent and warrant that:", "1. The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.", "2. You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Licensed Application, and other users of the Licensed Application to use your Contributions in any manner contemplated by the Licensed Application and this License Agreement.", "3. You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Licensed Application and this License Agreement.", "4. Your Contributions are not false, inaccurate, or misleading.", "5. Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.", "6. Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).", "7. Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.", "8. Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.", "9. Your Contributions do not violate any applicable law, regulation, or rule.", "10. Your Contributions do not violate the privacy or publicity rights of any third party.", "11. Your Contributions do not violate any applicable law concerning child sexual abuse material, or otherwise intended to protect the health or well-being of minors.", "12. Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.", "13. Your Contributions do not otherwise violate, or link to material that violates, any provision of this License Agreement, or any applicable law or regulation.", "Any use of the Licensed Application in violation of the foregoing violates this License Agreement and may result in, among other things, termination or suspension of your rights to use the Licensed Application."]}, {"heading": "7. Contribution license", "paragraphs": ["You own your Contributions. By posting them, you give LiteraryWorm the license described in the Terms of Service (\"What you post, and the licence you give us\"): a worldwide, non-exclusive, royalty-free license to store, copy and display your Contributions, only where and to whom you posted them, so we can run the features you use. The license ends when you delete the Contribution or your account, except for copies already made by others. Notes, highlights and private lists are never shown to anyone else.", "We are not liable for any statements or representations in your Contributions. You are solely responsible for your Contributions to the Licensed Application and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.", "We may remove Contributions that break this License Agreement or the Terms of Service, at any time and without notice. We have no obligation to monitor your Contributions."]}, {"heading": "8. Liability", "paragraphs": ["8.1 Licensor's responsibility in the case of violation of obligations and tort shall be limited to intent and gross negligence. Only in case of a breach of essential contractual duties (cardinal obligations), Licensor shall also be liable in case of slight negligence. In any case, liability shall be limited to the foreseeable, contractually typical damages. The limitation mentioned above does not apply to injuries to life, limb, or health.", "8.2 Licensor takes no accountability or responsibility for any damages caused due to a breach of duties according to Section 2 of this License Agreement. To avoid data loss, You can download a copy of your data at any time from Account (Download my data). You are aware that in case of alterations or manipulations of the Licensed Application, You may not have access to the Licensed Application."]}, {"heading": "9. Warranty", "paragraphs": ["9.1 Licensor warrants that the Licensed Application is free of spyware, trojan horses, viruses, or any other malware at the time You use it. Licensor warrants that the Licensed Application works as described in Help.", "9.2 No warranty is provided for the Licensed Application that is not executable on the Device, that has been unauthorizedly modified, handled inappropriately or culpably, combined or installed with inappropriate hardware or software, used with inappropriate accessories, regardless if by Yourself or by third parties, or if there are any other reasons outside of LiteraryWorm's sphere of influence that affect the executability of the Licensed Application.", "9.3 Please notify LiteraryWorm about issues You discover without delay by email at support@literaryworm.com. The defect report will be taken into consideration and further investigated if it has been emailed within a period of seven (7) days after discovery.", "9.4 If we confirm that the Licensed Application is defective, LiteraryWorm reserves a choice to remedy the situation either by means of solving the defect or substitute delivery.", "9.5 LiteraryWorm doesn't take payment yet, so there is no purchase price to refund. If paid memberships are added, the Terms of Service will say how refunds work.", "9.6 If the user is an entrepreneur, any claim based on faults expires after a statutory period of limitation amounting to twelve (12) months after the Licensed Application was made available to the user. The statutory periods of limitation given by law apply for users who are consumers."]}, {"heading": "10. Product claims", "paragraphs": ["LiteraryWorm is responsible for addressing any claims of the End-User or any third party relating to the Licensed Application or the End-User's possession and/or use of that Licensed Application, including, but not limited to: (i) product liability claims; (ii) any claim that the Licensed Application fails to conform to any applicable legal or regulatory requirement; and (iii) claims arising under consumer protection, privacy, or similar legislation."]}, {"heading": "11. Legal compliance", "paragraphs": ["You represent and warrant that You are not located in a country that is subject to a US Government embargo, or that has been designated by the US Government as a \"terrorist supporting\" country; and that You are not listed on any US Government list of prohibited or restricted parties."]}, {"heading": "12. Contact information", "paragraphs": ["For general inquiries, complaints, questions or claims concerning the Licensed Application, please email support@literaryworm.com."]}, {"heading": "13. Termination", "paragraphs": ["The license is valid until terminated by LiteraryWorm or by You. You can end it at any time by deleting your account from Account. Your rights under this license will terminate automatically and without notice from LiteraryWorm if You fail to adhere to any term(s) of this license. Upon License termination, You shall stop all use of the Licensed Application, and remove it and any books saved for offline reading from Your Devices."]}, {"heading": "14. Third-party terms of agreements", "paragraphs": ["LiteraryWorm represents and warrants that LiteraryWorm will comply with applicable third-party terms of agreement when using the Licensed Application, including those of the services it relies on: Supabase, Vercel, Anthropic, Google Books, the Internet Archive, LibriVox and Project Gutenberg."]}, {"heading": "15. Intellectual property rights", "paragraphs": ["LiteraryWorm and the End-User acknowledge that, in the event of any third-party claim that the Licensed Application or the End-User's possession and use of that Licensed Application infringes on the third party's intellectual property rights, LiteraryWorm will be solely responsible for the investigation, defense, settlement, and discharge of any such intellectual property infringement claims. Who owns the books and the app is set out in the Terms of Service."]}, {"heading": "16. Applicable law", "paragraphs": ["This License Agreement is governed by the laws of the State of Illinois excluding its conflicts of law rules."]}, {"heading": "17. Miscellaneous", "paragraphs": ["17.1 If any of the terms of this agreement should be or become invalid, the validity of the remaining provisions shall not be affected. Invalid terms will be replaced by valid ones formulated in a way that will achieve the primary purpose.", "17.2 Collateral agreements, changes and amendments are only valid if laid down in writing. The preceding clause can only be waived in writing."]}]$lw$::jsonb)
on conflict (slug) do nothing;

-- =============================================================================
-- 20261029000300_legal_acceptable_use.sql
-- =============================================================================
-- The Acceptable Use Policy (from the app's built-in copy, src/data/legalPages.json), after the End User License Agreement.
-- A fresh database already has it from the seed; this adds it to one seeded before it existed.

-- The pages after it move down one place first, so no two pages share a position.
update public.legal_pages p set position = v.position
from (values
  ($lw$copyright$lw$, 8),
  ($lw$disclaimer$lw$, 9),
  ($lw$help$lw$, 10),
  ($lw$status$lw$, 11)
) as v (slug, position)
where p.slug = v.slug;

insert into public.legal_pages (slug, position, title, summary, sections) values
  ($lw$acceptable-use$lw$, 7, $lw$Acceptable Use Policy$lw$, $lw$This Acceptable Use Policy ("Policy") is part of our Terms of Service ("Legal Terms") and should therefore be read alongside our main Legal Terms: https://www.literaryworm.com/legal/terms. It sets out what you may and may not do on LiteraryWorm, what you may post, how to use our AI features responsibly, and how to report anything that breaks it.$lw$, $lw$[{"heading": "Agreement to this policy", "paragraphs": ["When you use the AI-powered services provided by LiteraryWorm (\"AI Products\"), you warrant that you will comply with this document, our Legal Terms and all applicable laws and regulations governing AI. Our AI Products are the book summaries and Ask the book, which are written by Claude, an AI model made by Anthropic, and labelled as written by AI. Your usage of our AI Products signifies your agreement to engage with our platform in a lawful, ethical, and responsible manner that respects the rights and dignity of all individuals. If you do not agree with these Legal Terms, please refrain from using our Services. Your continued use of our Services implies acceptance of these Legal Terms.", "Please carefully review this Policy which applies to any and all:", "(a) uses of our Services (as defined in \"Legal Terms\");", "(b) forms, materials, consent tools, comments, posts, and all other content available on the Services (\"Content\");", "(c) material which you contribute to the Services, including any upload, post, reading log, rating, book club post, shared list or comment (\"Contribution\");", "(d) responsible implementation and management of AI Products within our Services."]}, {"heading": "Who we are", "paragraphs": ["We are LiteraryWorm (\"Company,\" \"we,\" \"us,\" or \"our\"). We operate the website https://www.literaryworm.com (the \"Site\"), as well as any other related products and services that refer or link to this Policy (collectively, the \"Services\")."]}, {"heading": "Use of the Services", "paragraphs": ["When you use the Services, you warrant that you will comply with this Policy and with all applicable laws.", "You also acknowledge that you may not:", "1. Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.", "2. Make any unauthorized use of the Services, including collecting display names and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.", "3. Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein, such as profile PINs, daily reading limits and age ratings.", "4. Engage in unauthorized framing of or linking to the Services.", "5. Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.", "6. Make improper use of our Services, including our support services, or submit false reports of abuse or misconduct.", "7. Engage in any automated use of the Services, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.", "8. Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.", "9. Attempt to impersonate another user or person or use the display name of another user.", "10. Use any information obtained from the Services in order to harass, abuse, or harm another person.", "11. Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.", "12. Decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services, except as expressly permitted by applicable law.", "13. Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.", "14. Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.", "15. Delete the copyright or other proprietary rights notice from any Content.", "16. Copy or adapt the Services' software, including but not limited to HTML, JavaScript, or other code.", "17. Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.", "18. Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats (\"gifs\"), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as \"spyware\" or \"passive collection mechanisms\" or \"pcms\").", "19. Except as may be the result of standard search engine or Internet browser usage, or the Services' own Read offline feature, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.", "20. Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.", "21. Use the Services in a manner inconsistent with any applicable laws or regulations.", "22. Use a buying agent or purchasing agent to make purchases on the Services.", "23. Sell or otherwise transfer your account or a profile."]}, {"heading": "Subscriptions", "paragraphs": ["If you subscribe to our Services, you understand, acknowledge, and agree that you may not, except if expressly permitted:", "1. Engage in any use, including modification, copying, redistribution, publication, display, performance, or retransmission, of any portions of any Services, other than as expressly permitted by this Policy, without the prior written consent of LiteraryWorm, which consent LiteraryWorm may grant or refuse in its sole and absolute discretion.", "2. Reconstruct or attempt to discover any source code or algorithms of the Services, or any portion thereof, by any means whatsoever. Being able to see source code we publish doesn't give you a license to use it.", "3. Provide, or otherwise make available, the Services to any third party, other than the people in your household who use the profiles on your account.", "4. Intercept any data not intended for you.", "5. Damage, reveal, or alter any user's data, or any other hardware, software, or information relating to another person or entity."]}, {"heading": "AI Products", "paragraphs": ["When you use the AI Products provided by LiteraryWorm, you warrant that you will not:", "1. Try to make the AI Products produce content that this Policy forbids, or that breaks Anthropic's usage policies.", "2. Deploy AI techniques that utilize subliminal, manipulative, or deceptive methods designed to distort behavior and impair informed decision-making, particularly when such actions cause significant harm to individuals.", "3. Exploit vulnerabilities related to age, disability, or socio-economic circumstances through AI in a way that distorts behavior or decision-making, especially if this results in significant harm to the individual.", "4. Use AI systems for biometric categorization that infer sensitive attributes such as race, political opinions, trade union membership, religious or philosophical beliefs, sex life, or sexual orientation, except in limited cases, such as labeling or filtering lawfully acquired datasets, or specific law enforcement activities.", "5. Implement AI-based social scoring systems that evaluate or classify individuals or groups based on their social behavior or personal traits in a manner that causes harm, discrimination, or unfair treatment.", "6. Assess the risk of an individual committing criminal offenses based solely on profiling, personality traits, or other non-behavioral factors, except in narrowly defined circumstances where legal safeguards are in place.", "7. Compile facial recognition databases through untargeted scraping of facial images from the internet, social media, or CCTV footage, unless it is part of a legally compliant and narrowly defined purpose.", "8. Use AI to infer emotions in sensitive environments such as workplaces, educational institutions, or any other context where such analysis could lead to discrimination, unfair treatment, or privacy violations.", "9. Engage in real-time remote biometric identification in public places for law enforcement purposes, except in specific situations where there are strong legal justifications and oversight mechanisms."]}, {"heading": "Artificial intelligence", "paragraphs": ["We recognize the significant impact AI can have on our users and society, and we are dedicated to ensuring that our AI Products are designed and operated in a manner that aligns with comprehensive ethical standards. We aim to use AI to enhance user experiences while upholding fairness, transparency, and accountability principles. That's why everything our AI Products write is labelled as written by AI, and why Ask the book is only given the text up to your place in the book.", "This Policy applies to all AI-powered features, services, and systems in our Services. It governs the development, deployment, and use of AI technologies to protect users' rights and maintain transparency in all AI operations. This Policy applies to all stakeholders, including employees, third-party vendors, and partners who contribute to or interact with our AI Products.", "Enforcement. Any misuse of our AI Products or failure to adhere to the standards outlined in this Policy will result in appropriate actions to ensure the integrity of our platform and the protection of our users. The specific consequences for misuse of AI may vary depending on the nature and severity of the violation and the user's history with our Services.", "Violations may include, but are not limited to:", "1. Engaging the AI Products in ways that violate user privacy, manipulate data, disregard ethical guidelines, or are against AI service providers' terms of use (for our AI Products, Anthropic's).", "2. Deploying AI in a manner that introduces or causes bias, leading to unfair treatment of users or groups.", "3. Improper handling, storage, or use of data by AI Products, leading to breaches of user trust and legal compliance.", "4. Using AI in a way that compromises the privacy and security of our systems, data, or users.", "Depending on the violation, LiteraryWorm may take one or more of the following actions:", "Warnings: The responsible party may receive a formal warning and be required to cease violating practices.", "Temporary Suspension: In cases of repeated or more severe violations, the responsible individual's access to AI Products or certain features of our platform may be temporarily suspended while the issue is investigated.", "Termination of Access: Serious violations, particularly those that result in harm to users or breach privacy or other regulations, may lead to the permanent termination of access to our AI Products and Services.", "Legal Action: In cases where the misuse of AI leads to significant harm, data breaches, or legal violations, we may pursue legal action against the party responsible. This could include reporting the incident to law enforcement or regulatory bodies.", "Public Disclosure: For incidents that impact public trust or involve severe ethical breaches, we reserve the right to publicly disclose the violation and the actions taken in response to maintain transparency and accountability.", "Commitment to Responsible AI. In addition to the consequences outlined above, we are deeply committed to repairing any harm caused by the misuse of AI. This commitment is a testament to our dedication to our users and our responsibility as a company. We will correct biased outcomes and implement additional safeguards to prevent future violations.", "At LiteraryWorm, we are committed to the ongoing refinement and enhancement of our Policy. As technology evolves and regulatory environments shift, we recognize the importance of keeping our policies up to date to ensure that they remain relevant, effective, and aligned with best practices in AI ethics. We will regularly review and update our Policy to reflect technological advancements and legal changes in local, national, and international regulations related to AI. Our Policy will be updated as needed to comply with new laws and guidelines, ensuring that our practices remain legally sound and socially responsible."]}, {"heading": "Contributions", "paragraphs": ["In this Policy, the term \"Contributions\" means: any data, information, text, messages or other materials that you post, share, upload, submit, or otherwise provide in any manner on or through the Services, such as reading logs, ratings, book club posts, list names and descriptions, notes and highlights, and books you upload; or any other content, materials, or data you provide to LiteraryWorm or use with the Services.", "Some areas of the Services allow users to upload, transmit, or post Contributions. We may but are under no obligation to review or moderate the Contributions made on the Services, and we expressly exclude our liability for any loss or damage resulting from any of our users' breach of this Policy. Please report any Contribution that you believe breaches this Policy; however, we will determine, in our sole discretion, whether a Contribution is indeed in breach of this Policy.", "You warrant that:", "1. you are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and this Policy;", "2. all your Contributions comply with applicable laws and are original and true (if they represent your opinion or facts);", "3. the creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party; and", "4. you have the verifiable consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and this Policy.", "You also agree that you will not post, transmit, or upload any (or any part of a) Contribution that:", "1. is in breach of applicable laws, regulation, court order, contractual obligation, this Policy, our Legal Terms, a legal duty, or that promotes or facilitates fraud or illegal activities;", "2. is defamatory, obscene, offensive, hateful, insulting, intimidating, bullying, abusive, or threatening, to any person or group;", "3. is false, inaccurate, or misleading;", "4. includes child sexual abuse material, or violates any applicable law intended to protect minors;", "5. contains any material that solicits personal information from anyone under the age of 18 or exploits people under the age of 18 in a sexual or violent manner;", "6. promotes violence, advocates the violent overthrow of any government, or incites, encourages, or threatens physical harm against another;", "7. is obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, contains sexually explicit material, or is otherwise objectionable (as determined by us);", "8. is discriminatory based on race, sex, religion, nationality, disability, sexual orientation, or age;", "9. bullies, intimidates, humiliates, or insults any person;", "10. promotes, facilitates, or assists anyone in promoting and facilitating acts of terrorism;", "11. infringes, or assists anyone in infringing, a third party's intellectual property rights or publicity or privacy rights;", "12. is deceitful, misrepresents your identity or affiliation with any person and/or misleads anyone as to your relationship with us or implies that the Contribution was made by someone else than you;", "13. contains unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation that has been \"paid for,\" whether with monetary compensation or in kind; or", "14. misrepresents your identity or who the Contribution is from."]}, {"heading": "Reviews and ratings", "paragraphs": ["When your Contribution is a review or rating of a book, such as a rating or a reading log, you also agree that:", "1. you have firsthand experience with the book being reviewed;", "2. your Contribution is true to your experience;", "3. you are not affiliated with competitors if posting negative reviews (or linked in any way to, e.g., by being the author or publisher of, a book if posting positive reviews);", "4. you cannot make or offer any conclusions as to the legality of conduct;", "5. you cannot post any false or misleading statements; and", "6. you do not and will not organize a campaign encouraging others to post reviews, whether positive or negative."]}, {"heading": "Reporting a breach of this policy", "paragraphs": ["We may but are under no obligation to review or moderate the Contributions made on the Services and we expressly exclude our liability for any loss or damage resulting from any of our users' breach of this Policy.", "If you consider that any Service, Content, or Contribution breaches this Policy, please email us at report@literaryworm.com to let us know which Service, Content, or Contribution is in breach of this Policy and why.", "If you consider that any Service, Content, or Contribution infringes any third-party intellectual property rights, please email us at report@literaryworm.com. For a formal notice under the Digital Millennium Copyright Act, follow the steps on our Copyright/DMCA page.", "You can also send detailed feedback on your interactions with our AI Products by emailing report@literaryworm.com. Please include specific details about the AI interaction, such as the book, the context, the nature of the concern, and any relevant screenshots or documentation.", "We will reasonably determine whether a Service, Content, or Contribution breaches this Policy."]}, {"heading": "Consequences of breaching this policy", "paragraphs": ["The consequences for violating our Policy will vary depending on the severity of the breach and the user's history on the Services, by way of example:", "We may, in some cases, give you a warning and/or remove the infringing Contribution, however, if your breach is serious or if you continue to breach our Legal Terms and this Policy, we have the right to suspend or terminate your access to and use of our Services and, if applicable, disable your account. We may also notify law enforcement or issue legal proceedings against you when we believe that there is a genuine risk to an individual or a threat to public safety.", "We exclude our liability for all action we may take in response to any of your breaches of this Policy."]}, {"heading": "Complaints and removal of legitimate content", "paragraphs": ["If you consider that some Content or Contribution has been mistakenly removed or blocked from the Services, please email us at report@literaryworm.com and we will promptly review our decision to remove such Content or Contribution. The Content or Contribution may stay \"down\" whilst we conduct the review process. If it was removed after a copyright notice, you can also send a counter-notice, as our Copyright/DMCA page explains."]}, {"heading": "Disclaimer", "paragraphs": ["LiteraryWorm is under no obligation to monitor users' activities, and we disclaim any responsibility for any user's misuse of the Services. LiteraryWorm has no responsibility for any user or other Content or Contribution created, maintained, stored, transmitted, or accessible on or through the Services, and is not obligated to monitor or exercise any editorial control over such material. If LiteraryWorm becomes aware that any such Content or Contribution violates this Policy, LiteraryWorm may, in addition to removing such Content or Contribution and blocking your account, report such breach to the police or appropriate regulatory authority. Unless otherwise stated in this Policy, LiteraryWorm disclaims any obligation to any person who has not entered into an agreement with LiteraryWorm for the use of the Services."]}, {"heading": "How can you contact us about this policy?", "paragraphs": ["If you have any further questions or comments or wish to report any problematic Content or Contribution, you may contact us by email: report@literaryworm.com."]}]$lw$::jsonb)
on conflict (slug) do nothing;

-- =============================================================================
-- 20261029000400_legal_returns.sql
-- =============================================================================
-- The Return Policy (from the app's built-in copy, src/data/legalPages.json), after the Acceptable Use Policy.
-- A fresh database already has it from the seed; this adds it to one seeded before it existed.

-- The pages after it move down one place first, so no two pages share a position.
update public.legal_pages p set position = v.position
from (values
  ($lw$copyright$lw$, 9),
  ($lw$disclaimer$lw$, 10),
  ($lw$help$lw$, 11),
  ($lw$status$lw$, 12)
) as v (slug, position)
where p.slug = v.slug;

insert into public.legal_pages (slug, position, title, summary, sections) values
  ($lw$returns$lw$, 8, $lw$Return Policy$lw$, $lw$How refunds work for LiteraryWorm memberships, and who to contact with questions.$lw$, $lw$[{"heading": "Refunds", "paragraphs": ["LiteraryWorm doesn't take payment yet: choosing a plan saves it to your account, but no one is charged, so there is nothing to refund at the moment.", "Once paid plans start, all sales are final and no refund will be issued. You can cancel at any time from Account; your plan stays active until the end of the period you've paid for, and you won't be charged again.", "This doesn't affect any rights you have under the law where you live."]}, {"heading": "Questions", "paragraphs": ["If you have any questions concerning our return policy, please contact us at support@literaryworm.com."]}]$lw$::jsonb)
on conflict (slug) do nothing;

-- =============================================================================
-- 20261029001800_complimentary_admin_memberships.sql
-- =============================================================================
-- Admin accounts are never billed.
--
-- An admin's membership is complimentary: Premium, always active, with no
-- billing day, no renewal and no Stripe subscription, so nothing can be charged
-- for it, now or once payment is added. The database decides this, not the
-- browser or the functions: a trigger sets subscriptions.complimentary from
-- staff_roles on every write, so no one can mark their own membership
-- complimentary and an admin's can't be turned into a paid one.
--
-- Granting the admin role starts (or converts) the membership; removing it ends
-- a complimentary membership (the row is removed), so the account has to choose
-- a plan, and agree to its renewal terms, before anything could be charged.

alter table public.subscriptions
  add column complimentary boolean not null default false;

-- A complimentary membership has no billing day and no renewal consent to record.
alter table public.subscriptions
  alter column billing_day drop not null,
  alter column renewal_terms_accepted_at drop not null;

-- Keeps every write consistent with the account's roles (runs before the checks below).
create function private.subscriptions_set_complimentary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.complimentary := exists (
    select 1 from public.staff_roles where user_id = new.user_id and role = 'admin'
  );
  if new.complimentary then
    new.plan_id := 'premium';
    new.status := 'active';
    new.billing_day := null;
    new.cancel_at_period_end := false;
    new.current_period_end := null;
    new.stripe_subscription_id := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.subscriptions_set_complimentary() from public, anon, authenticated;

create trigger subscriptions_set_complimentary
  before insert or update on public.subscriptions
  for each row execute function private.subscriptions_set_complimentary();

alter table public.subscriptions
  add constraint subscriptions_paid_needs_billing
    check (complimentary or (billing_day is not null and renewal_terms_accepted_at is not null)),
  add constraint subscriptions_complimentary_never_billed
    check (not complimentary or (billing_day is null and status = 'active' and not cancel_at_period_end
                                 and current_period_end is null and stripe_subscription_id is null));

-- Granting or removing the admin role starts or ends the complimentary membership.
create function private.sync_admin_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscriptions (user_id, plan_id, status)
    values (new.user_id, 'premium', 'active')
    on conflict (user_id) do update set updated_at = now();  -- the trigger above converts it
  else
    -- No longer an admin: the free membership ends and the account has no plan, so it
    -- chooses one (and agrees to its renewal terms) before anything could be charged.
    delete from public.subscriptions where user_id = old.user_id and complimentary;
  end if;
  return null;
end;
$$;
revoke execute on function private.sync_admin_membership() from public, anon, authenticated;

create trigger staff_roles_admin_granted
  after insert on public.staff_roles
  for each row when (new.role = 'admin')
  execute function private.sync_admin_membership();

create trigger staff_roles_admin_removed
  after delete on public.staff_roles
  for each row when (old.role = 'admin')
  execute function private.sync_admin_membership();

-- Members may see that their membership is complimentary.
grant select (complimentary) on public.subscriptions to authenticated;

-- The admins there are now: their memberships become complimentary.
update public.subscriptions s set updated_at = now()
 where exists (select 1 from public.staff_roles r where r.user_id = s.user_id and r.role = 'admin');
insert into public.subscriptions (user_id, plan_id, status)
select r.user_id, 'premium', 'active' from public.staff_roles r where r.role = 'admin'
on conflict (user_id) do nothing;

-- =============================================================================
-- 20261029001900_stripe_billing.sql
-- =============================================================================
-- Stripe billing.
--
-- Members pay through Stripe Checkout (Stripe-hosted, so card details never
-- reach LiteraryWorm). The checkout Edge Function creates a Stripe Customer and
-- a Checkout Session; the stripe-webhook function keeps public.subscriptions in
-- step with Stripe. The two tables have RLS on and no browser access at all
-- (only the functions, with the service role, read and write them).
--
-- public.stripe_customers   which Stripe Customer belongs to which account
--                            (events are mapped to accounts through it, not
--                            through metadata)
-- public.stripe_events      every webhook event once (repeats are skipped),
--                            with disputes, refunds and fraud warnings kept for
--                            the team to act on
-- subscriptions.stripe_linked  whether the membership is billed through Stripe,
--                            so the app can ask unlinked members to add a
--                            payment method without seeing Stripe's ids

create table public.stripe_customers (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  customer_id text not null unique check (customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at  timestamptz not null default now()
);

create table public.stripe_events (
  id          text primary key check (id ~ '^evt_[A-Za-z0-9]+$'),
  type        text not null check (char_length(type) between 1 and 120),
  object_id   text,
  livemode    boolean not null,
  needs_review boolean not null default false,  -- disputes, refunds, early fraud warnings
  received_at timestamptz not null default now()
);
-- Indexes are in the 1901 and 1902 migrations (CREATE INDEX CONCURRENTLY runs outside a transaction).

alter table public.stripe_customers enable row level security;
alter table public.stripe_events enable row level security;
revoke all on public.stripe_customers, public.stripe_events from anon, authenticated;

alter table public.subscriptions
  add column stripe_linked boolean generated always as (stripe_subscription_id is not null) stored;
grant select (stripe_linked) on public.subscriptions to authenticated;

-- =============================================================================
-- 20261029001901_index_subscriptions_stripe_subscription_id.sql
-- =============================================================================
-- A Stripe subscription belongs to one account. Kept to one statement: CONCURRENTLY can't run in a transaction.
create unique index concurrently if not exists subscriptions_stripe_subscription_id_key
  on public.subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;

-- =============================================================================
-- 20261029001902_index_stripe_events_needs_review.sql
-- =============================================================================
-- The events the team has to look at (disputes, refunds, fraud warnings). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists stripe_events_needs_review_idx
  on public.stripe_events (received_at) where needs_review;

-- =============================================================================
-- 20261029002000_player_speed.sql
-- =============================================================================
-- The audiobook player's speed joins the other player settings on the profile
-- (Phase 13 kept it for the session only). One of the speeds the player offers.

alter table public.reader_profiles
  add column playback_speed numeric(3, 2) not null default 1
    check (playback_speed in (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3));

grant select (playback_speed) on public.reader_profiles to authenticated;
grant update (playback_speed) on public.reader_profiles to authenticated;

-- =============================================================================
-- 20261029002100_two_step_sign_in.sql
-- =============================================================================
-- Two-step sign-in (TOTP, Supabase Auth MFA).
--
-- A member who turns it on signs in with their password (a session at aal1),
-- then a code from their authenticator app (aal2). Until the code is given,
-- the session can reach nothing of theirs: every table a member uses gets a
-- restrictive policy that needs aal2 from anyone with a verified factor.
-- Members without one are unaffected. Public reads (logs, display names,
-- plans, legal pages) stay open; only writes to those tables need the code.
--
-- Security-definer functions skip RLS, so the two that act for a member check
-- for themselves: has_staff_role() (used by every staff function and policy)
-- and join_club(). The user-books bucket gets the same restrictive policy.
-- Edge Functions check the session's aal in _shared/supabase.ts.

-- True unless the caller has a verified factor and the session hasn't used it.
-- Security definer to read auth.mfa_factors; it only ever answers for the caller.
create or replace function public.second_step_done()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

revoke execute on function public.second_step_done() from public, anon;
grant execute on function public.second_step_done() to authenticated, service_role;


-- Private tables: no reading or writing without the second step ---------------
create policy "Two-step sign-in when turned on" on public.account_private      as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.book_clubs           as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.book_ratings         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.bookmarks            as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.club_listening       as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.club_members         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.club_posts           as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.custom_list_items    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.custom_lists         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.favorites            as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.finished_books       as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.highlights           as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.legal_page_revisions as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.library_items        as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.listening_devices    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.parental_consents    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.playback_handoffs    as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reader_profiles      as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reading_days         as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reading_goals        as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.reading_progress     as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.staff_roles          as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.subscriptions        as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in when turned on" on public.uploaded_books       as restrictive for all to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Publicly readable tables: reading stays open, writing needs the second step --
create policy "Two-step sign-in to write logs" on public.logs as restrictive for insert to authenticated with check ((select public.second_step_done()));
create policy "Two-step sign-in to edit logs" on public.logs as restrictive for update to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in to delete logs" on public.logs as restrictive for delete to authenticated using ((select public.second_step_done()));
create policy "Two-step sign-in to change a display name" on public.profiles as restrictive for update to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in to edit legal pages" on public.legal_pages as restrictive for update to authenticated using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Uploaded books' files ---------------------------------------------------------
create policy "Two-step sign-in for book files" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'user-books' or (select public.second_step_done()))
  with check (bucket_id <> 'user-books' or (select public.second_step_done()));


-- Security-definer callers -------------------------------------------------------
-- Staff functions run as their owner, so staff_roles' policies don't apply there.
create or replace function public.has_staff_role(p_role public.staff_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.second_step_done() and exists (
    select 1 from public.staff_roles
    where user_id = (select auth.uid()) and role in (p_role, 'admin')
  );
$$;

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
  if v_user is null or not public.second_step_done() then
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

-- =============================================================================
-- 20261029002200_follows.sql
-- =============================================================================
-- Follow an author or narrator (story 35).
--
-- Per profile, like favourites: each profile follows its own authors and
-- narrators, and their page shows Following. The name is the one shown on the
-- book (the catalog's author or narrator, or Google Books' author), which is
-- also how the page is found. Up to 200 a profile.

create table public.follows (
  profile_id uuid not null,
  user_id    uuid not null,
  kind       text not null check (kind in ('author', 'narrator')),
  name       text not null check (char_length(name) between 1 and 100 and name = btrim(name)),
  created_at timestamptz not null default now(),
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, kind, name),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_follow_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.follows where profile_id = new.profile_id) >= 200 then
    raise exception 'A profile can follow up to 200 authors and narrators' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_follow_limit() from public, anon, authenticated;

create trigger follows_limit
  before insert on public.follows
  for each row execute function private.enforce_follow_limit();

alter table public.follows enable row level security;

create policy "Readers see who they follow" on public.follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers follow for their own profiles" on public.follows for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers unfollow" on public.follows for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.follows as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (profile_id, user_id, kind, name) on public.follows to authenticated;

-- The Privacy Policy and Children's Privacy Notice list what we keep: add follows
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old
-- version; a page an editor has reworded since is left as it is.
update public.legal_pages
set sections = replace(sections::text, 'ratings, favourites and lists, recent searches',
                       'ratings, favourites and lists, the authors and narrators you follow, recent searches')::jsonb
where slug = 'privacy' and sections::text like '%ratings, favourites and lists, recent searches%';

update public.legal_pages
set sections = replace(sections::text, 'ratings, favourites and lists, reading time and goals',
                       'ratings, favourites and lists, the authors and narrators it follows, reading time and goals')::jsonb
where slug = 'childrens-privacy' and sections::text like '%ratings, favourites and lists, reading time and goals%';

-- =============================================================================
-- 20261029002300_release_reminders.sql
-- =============================================================================
-- Remind Me for books that aren't out yet (story 48).
--
-- Per profile, like favourites. A reminder keeps the title, first author and
-- release date the book page showed, so Home and My Library can list it
-- without asking Google Books again. Once the date passes, Home shows it as
-- out now until the reader dismisses it (which deletes the reminder).
-- Up to 100 a profile; only for books not out yet.

create table public.release_reminders (
  profile_id   uuid not null,
  user_id      uuid not null,
  volume_id    text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  author       text check (char_length(author) <= 200),
  release_date date not null,
  created_at   timestamptz not null default now(),
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_reminder_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A day's slack either side of the reader's own date.
  if new.release_date < current_date - 1 then
    raise exception 'That book is already out' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.release_reminders where profile_id = new.profile_id) >= 100 then
    raise exception 'A profile can have up to 100 reminders' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_reminder_rules() from public, anon, authenticated;

create trigger release_reminders_rules
  before insert on public.release_reminders
  for each row execute function private.enforce_reminder_rules();

alter table public.release_reminders enable row level security;

create policy "Readers see their own reminders" on public.release_reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers set reminders for their own profiles" on public.release_reminders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers remove their own reminders" on public.release_reminders for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.release_reminders as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.release_reminders from anon, authenticated;
grant select, delete on public.release_reminders to authenticated;
grant insert (profile_id, user_id, volume_id, title, author, release_date) on public.release_reminders to authenticated;

-- The Privacy Policy and Children's Privacy Notice list what we keep: add
-- reminders (src/data/legalPages.json has the same change). The edit trigger
-- keeps the old version; a page an editor has reworded since is left as it is.
update public.legal_pages
set sections = replace(sections::text, 'the authors and narrators you follow, recent searches',
                       'the authors and narrators you follow, release reminders, recent searches')::jsonb
where slug = 'privacy' and sections::text like '%the authors and narrators you follow, recent searches%';

update public.legal_pages
set sections = replace(sections::text, 'the authors and narrators it follows, reading time and goals',
                       'the authors and narrators it follows, release reminders, reading time and goals')::jsonb
where slug = 'childrens-privacy' and sections::text like '%the authors and narrators it follows, reading time and goals%';

-- =============================================================================
-- 20261029002400_cookie_policy_preview.sql
-- =============================================================================
-- The Google Books preview (an embedded viewer on some book pages, loaded only
-- when the reader opens it) is a new third party the browser reaches: the
-- Cookie Policy says so (src/data/legalPages.json has the same change). The
-- edit trigger keeps the old version; a page an editor has reworded since is
-- left as it is.
update public.legal_pages
set sections = replace(sections::text,
      'Some book covers from Google Books, and the audiobook recordings streamed from the Internet Archive, load from those services.',
      'Some book covers from Google Books, the Google Books preview on some book pages (only when you open it), and the audiobook recordings streamed from the Internet Archive, load from those services.')::jsonb
where slug = 'cookies'
  and sections::text like '%Some book covers from Google Books, and the audiobook recordings streamed from the Internet Archive, load from those services.%';

-- =============================================================================
-- 20261029002500_legal_mailgun.sql
-- =============================================================================
-- Auth emails (confirming an address, resetting a password) are now sent by
-- Mailgun, through Supabase Auth's SMTP setting: the Privacy Policy names it as a
-- service provider and the EULA lists it with the other services the app relies on
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old
-- versions; a page an editor has reworded since is left as it is.
update public.legal_pages
set sections = replace(sections::text, $lw$Vercel hosts the website. Neither may use your data for their own purposes.$lw$, $lw$Vercel hosts the website. Mailgun sends our account emails (confirming your email address and resetting your password), so it receives your email address and each email's contents. None of them may use your data for their own purposes.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Vercel hosts the website. Neither may use your data for their own purposes.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Supabase, Vercel, Anthropic, Google Books$lw$, $lw$Supabase, Vercel, Mailgun, Anthropic, Google Books$lw$)::jsonb
where slug = 'eula'
  and sections::text like $lw$%Supabase, Vercel, Anthropic, Google Books%$lw$;

-- =============================================================================
-- 20261029002600_staff_dashboard.sql
-- =============================================================================
-- The staff dashboard (new request): how LiteraryWorm is doing, for billing
-- staff and admins.
--
-- Totals only: no names, emails or ids leave this function, and nothing is
-- stored. It reads across every account, so it's SECURITY DEFINER and checks
-- the role itself (has_staff_role() also needs the two-step code when it's on).
-- Monthly revenue is what active paid memberships cost a month at list price,
-- before promo codes; complimentary memberships are counted but never priced.

create function public.staff_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('billing') then
    raise exception 'Only billing staff and admins can see the dashboard' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'accounts', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new_30_days', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'profiles', (select count(*) from public.reader_profiles),
      'kids_profiles', (select count(*) from public.reader_profiles where age_rating = 'kids')
    ),
    -- Sign-ups a week, oldest first: the last 12 weeks, this week included.
    'weekly_sign_ups', (
      select jsonb_agg(jsonb_build_object('week', w.week, 'count', (
               select count(*) from public.profiles p
                where p.created_at >= w.week and p.created_at < w.week + interval '7 days'))
             order by w.week)
        from (select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days')::date as week) w
    ),
    'memberships', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'plan', p.id, 'name', p.name, 'price_cents', p.price_cents, 'currency', p.currency,
               'active', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'active' and not s.complimentary),
               'paused', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'paused'),
               'past_due', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'past_due'),
               'cancelled', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'cancelled'),
               'cancelling', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'active' and s.cancel_at_period_end),
               'complimentary', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.complimentary)
             ) order by p.sort_order), '[]'::jsonb)
        from public.plans p
    ),
    'monthly_revenue_cents', (
      select coalesce(sum(p.price_cents), 0)
        from public.subscriptions s join public.plans p on p.id = s.plan_id
       where s.status = 'active' and not s.complimentary
    ),
    'reading', jsonb_build_object(
      'active_readers_7_days', (select count(distinct profile_id) from public.reading_days where day >= current_date - 6 and minutes > 0),
      'minutes_30_days', (select coalesce(sum(minutes), 0) from public.reading_days where day >= current_date - 29),
      'listening_minutes_30_days', (select coalesce(sum(listening_minutes), 0) from public.reading_days where day >= current_date - 29),
      'books_finished_30_days', (select coalesce(sum(books_finished), 0) from public.reading_days where day >= current_date - 29)
    ),
    'clubs', jsonb_build_object(
      'running', (select count(*) from public.book_clubs where finishes_on >= current_date),
      'posts_30_days', (select count(*) from public.club_posts where created_at >= now() - interval '30 days')
    ),
    'stripe_events_to_review', (select count(*) from public.stripe_events where needs_review)
  );
end;
$$;
revoke execute on function public.staff_dashboard() from public, anon;
grant execute on function public.staff_dashboard() to authenticated;

-- =============================================================================
-- 20261029002700_gift_memberships.sql
-- =============================================================================
-- Gift memberships (new request).
--
-- A member pays once on Stripe Checkout for 1, 3, 6 or 12 months of a plan; the
-- stripe-webhook function then makes a gift code (16 letters and digits, with
-- no 0/O or 1/I so it's easy to read out) and keeps it here. The buyer sees
-- their codes; nobody else can read them. Whoever has the code redeems it once
-- in Account, through the manage-account function: Stripe gives their
-- membership the free months (a trial, so nothing is charged), and the webhook
-- writes the membership as usual. Codes don't expire.
--
-- Rows are written only by the functions (service role): never from the browser.

create table public.gift_codes (
  id                         uuid primary key default gen_random_uuid(),
  code                       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{16}$'),
  plan_id                    text not null references public.plans (id),
  months                     smallint not null check (months in (1, 3, 6, 12)),
  amount_cents               integer not null check (amount_cents > 0),
  currency                   char(3) not null default 'USD',
  -- Kept when the buyer deletes their account, so a code already given still works.
  buyer_id                   uuid references auth.users (id) on delete set null,
  stripe_checkout_session_id text not null unique check (stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  redeemed_by                uuid references auth.users (id) on delete set null,
  redeemed_at                timestamptz,
  created_at                 timestamptz not null default now(),
  -- Who redeemed it is cleared if they delete their account; when stays, so it can't be used again.
  check (redeemed_by is null or redeemed_at is not null)
);
-- Foreign key indexes are in the 2701–2703 migrations (CREATE INDEX CONCURRENTLY runs outside a transaction).

alter table public.gift_codes enable row level security;
create policy "Buyers see the gifts they bought" on public.gift_codes for select to authenticated
  using (buyer_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.gift_codes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
revoke all on public.gift_codes from anon, authenticated;
-- Not the Stripe session or who redeemed it: only whether and when.
grant select (id, code, plan_id, months, amount_cents, currency, redeemed_at, created_at) on public.gift_codes to authenticated;

-- subscriptions.gift_until: the end of the free months a gift gave, while
-- they last (from the Stripe subscription's metadata, written by the webhook).
-- Account shows it, and the billing day can't move until it's passed.
alter table public.subscriptions add column gift_until timestamptz;
grant select (gift_until) on public.subscriptions to authenticated;

-- =============================================================================
-- 20261029002701_index_gift_codes_buyer_id.sql
-- =============================================================================
-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists gift_codes_buyer_id_idx on public.gift_codes (buyer_id);

-- =============================================================================
-- 20261029002702_index_gift_codes_redeemed_by.sql
-- =============================================================================
-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists gift_codes_redeemed_by_idx on public.gift_codes (redeemed_by);

-- =============================================================================
-- 20261029002703_index_gift_codes_plan_id.sql
-- =============================================================================
-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists gift_codes_plan_id_idx on public.gift_codes (plan_id);

-- =============================================================================
-- 20261029002800_legal_gifts.sql
-- =============================================================================
-- Gift memberships: the Privacy Policy says what's kept about a gift and who sees
-- its code, and the Return Policy says gifts are final, don't expire and what
-- happens when the free months end (src/data/legalPages.json has the same change).
-- The edit trigger keeps the old versions; a page an editor has reworded since is
-- left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Stripe's ids for your customer record and subscription, and whether each payment succeeded.$lw$, $lw$Stripe's ids for your customer record and subscription, and whether each payment succeeded. If you buy a gift membership, we keep its code, plan, number of months and price, and whether and when it was redeemed; only the buyer can see the code, and we record which account redeemed it.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Stripe's ids for your customer record and subscription, and whether each payment succeeded.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$payment history (amounts, dates and whether each payment succeeded), with Stripe's ids$lw$, $lw$payment history (amounts, dates and whether each payment succeeded), gift memberships you bought or redeemed (plan, months, price and when redeemed), with Stripe's ids$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%payment history (amounts, dates and whether each payment succeeded), with Stripe's ids%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$which stops billing until you resume."$lw$, $lw$which stops billing until you resume.", "Gift memberships are paid once and are final too. A gift code doesn't expire, works once, and can't be exchanged for cash or refunded. Redeeming one gives its months free on the gift's plan; when they end, the membership ends unless a card has been added, and then it renews monthly until you cancel."$lw$)::jsonb
where slug = 'returns'
  and sections::text like $lw$%which stops billing until you resume."%$lw$;

-- =============================================================================
-- 20261029002900_release_emails.sql
-- =============================================================================
-- Book-out emails (new request): when a book a profile set Remind me on comes
-- out, the account holder gets one email listing it (and any others out the
-- same day), as well as the Home card. Sent by the release-emails function
-- through Mailgun's API (SEND_MAILGUN_EMAIL and MAILGUN_DOMAIN function settings),
-- which pg_cron calls every hour.
--
-- * account_private.release_emails: on unless the account holder turns it off
--   in Account → Preferences (they asked for each reminder, so it's a service
--   email, not marketing).
-- * release_reminders.emailed_at: when the email went (or is going) out, so
--   each reminder is emailed once. Only the function writes it.
-- * claim_release_emails(): for the function only (service role). Marks up to
--   max_count due reminders as emailed and returns them with the address to
--   use; the function hands back any it couldn't send. Reminders for books out
--   more than a week ago aren't emailed (say, after turning emails back on).
-- * The function is called with a random secret kept in Vault
--   (release_emails_secret, made here), which it checks through
--   release_emails_secret(). The cron job does nothing until the project's URL
--   is in Vault as project_url (set once per project; not set locally).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.account_private add column release_emails boolean not null default true;
grant select (release_emails), update (release_emails) on public.account_private to authenticated;

alter table public.release_reminders add column emailed_at timestamptz;
-- Readers already have select on the whole table; emailed_at isn't in their insert grant
-- and they have no update, so only the function sets it.

-- The index for the hourly look for due reminders is in migration 2901 (CREATE INDEX
-- CONCURRENTLY runs outside a transaction).

create or replace function public.claim_release_emails(max_count integer default 200)
returns table (
  user_id      uuid,
  email        text,
  account_name text,
  profile_id   uuid,
  profile_name text,
  volume_id    text,
  title        text,
  author       text,
  release_date date
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select r.profile_id, r.user_id, r.volume_id
    from public.release_reminders r
    join public.account_private a on a.user_id = r.user_id and a.release_emails
    join auth.users u on u.id = r.user_id and u.email is not null and u.email_confirmed_at is not null
    where r.emailed_at is null
      and r.release_date <= current_date
      and r.release_date > current_date - 7
    order by r.user_id, r.release_date
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    -- Two runs at once each get different reminders.
    for update of r skip locked
  ), claimed as (
    update public.release_reminders r
    set emailed_at = now()
    from due
    where r.profile_id = due.profile_id and r.user_id = due.user_id and r.volume_id = due.volume_id
    returning r.user_id, r.profile_id, r.volume_id, r.title, r.author, r.release_date
  )
  select c.user_id, u.email::text, p.display_name, c.profile_id, rp.name, c.volume_id, c.title, c.author, c.release_date
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id
  left join public.reader_profiles rp on rp.id = c.profile_id
  order by c.user_id, c.release_date, c.title;
end;
$$;
revoke execute on function public.claim_release_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_release_emails(integer) to service_role;

-- The secret the cron job sends and the function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'release_emails_secret', 'Sent by the release-emails cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'release_emails_secret');

create or replace function public.release_emails_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'release_emails_secret';
$$;
revoke execute on function public.release_emails_secret() from public, anon, authenticated;
grant execute on function public.release_emails_secret() to service_role;

create or replace function private.call_release_emails()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'release_emails_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/release-emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function private.call_release_emails() from public, anon, authenticated;

-- Quarter past every hour: books out today go out early in the (UTC) day, and anything a
-- failed send handed back is tried again an hour later.
select cron.schedule('release-emails', '15 * * * *', 'select private.call_release_emails()');

-- =============================================================================
-- 20261029002901_index_release_reminders_due.sql
-- =============================================================================
-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists release_reminders_due_idx on public.release_reminders (release_date) where emailed_at is null;

-- =============================================================================
-- 20261029003000_legal_release_emails.sql
-- =============================================================================
-- Book-out emails: the Privacy Policy says Mailgun also sends the email when a reminded
-- book is out (without open or click tracking), that the account keeps whether those
-- emails are wanted, and that they can be turned off apart from marketing
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old
-- versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Mailgun sends our account emails (confirming your email address and resetting your password), so it receives your email address and each email's contents.$lw$, $lw$Mailgun sends our emails (confirming your email address, resetting your password, and telling you when a book you set Remind me on is out), so it receives your email address and each email's contents. We turn off Mailgun's open and click tracking.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Mailgun sends our account emails (confirming your email address and resetting your password), so it receives your email address and each email's contents.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$whether you'd like marketing emails, when you accepted the Terms$lw$, $lw$whether you'd like marketing emails and emails when a reminded book is out, when you accepted the Terms$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%whether you'd like marketing emails, when you accepted the Terms%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$necessary for the administration and use of your account,$lw$, $lw$necessary for the administration and use of your account (emails about books you set Remind me on can be turned off separately in Account),$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%necessary for the administration and use of your account,%$lw$;

-- =============================================================================
-- 20261029003100_club_invites.sql
-- =============================================================================
-- Club invites by email (new request): a club member types someone's email
-- address on the club page, and the club-invite function emails them a link
-- that joins the club (/clubs/join/<code>), through Mailgun's API.
--
-- The address itself is never stored. club_invites keeps a one-way fingerprint
-- of it (sha256 of the club and the lower-cased address, made by the function)
-- for 30 days, only so the same address isn't invited to the same club again
-- within a week, and so each member can send at most 10 invitations a day.
-- Nobody reads it from the browser; a daily pg_cron job removes rows after 30 days.

create table public.club_invites (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.book_clubs (id) on delete cascade,
  invited_by  uuid not null references public.profiles (id) on delete cascade,
  email_hash  text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now()
);
-- Foreign key indexes are in the 3101–3102 migrations (CREATE INDEX CONCURRENTLY runs outside a transaction).

alter table public.club_invites enable row level security;
-- No policies for anon or authenticated: only the club-invite function (service role) uses it.
create policy "Two-step sign-in when turned on" on public.club_invites as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
revoke all on public.club_invites from anon, authenticated;

-- Checks the inviter may invite to this club and records the invitation. For the
-- club-invite function only (service role), which has already checked who's asking.
-- Returns {status} as one of: ok (with the club's details for the email),
-- not_member, full, too_many, already_invited.
create or replace function public.record_club_invite(p_user uuid, p_club uuid, p_email_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club   public.book_clubs%rowtype;
  v_invite uuid;
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'email_hash must be 64 hex digits' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.club_members where club_id = p_club and user_id = p_user) then
    return jsonb_build_object('status', 'not_member');
  end if;
  select * into v_club from public.book_clubs where id = p_club;
  if (select count(*) from public.club_members where club_id = p_club) >= 50 then
    return jsonb_build_object('status', 'full');
  end if;
  if (select count(*) from public.club_invites where invited_by = p_user and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('status', 'too_many');
  end if;
  if exists (select 1 from public.club_invites
             where club_id = p_club and email_hash = p_email_hash and created_at > now() - interval '7 days') then
    return jsonb_build_object('status', 'already_invited');
  end if;
  insert into public.club_invites (club_id, invited_by, email_hash) values (p_club, p_user, p_email_hash)
  returning id into v_invite;
  return jsonb_build_object(
    'status', 'ok',
    'invite_id', v_invite,
    'club_name', v_club.name,
    'volume_id', v_club.volume_id,
    'finishes_on', v_club.finishes_on,
    'invite_code', v_club.invite_code,
    'inviter_name', (select display_name from public.profiles where id = p_user)
  );
end;
$$;
revoke execute on function public.record_club_invite(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_club_invite(uuid, uuid, text) to service_role;

-- Daily at 03:30 UTC: forget fingerprints older than 30 days.
select cron.schedule('club-invites-cleanup', '30 3 * * *',
  $job$delete from public.club_invites where created_at < now() - interval '30 days'$job$);

-- =============================================================================
-- 20261029003101_index_club_invites_club_id.sql
-- =============================================================================
-- Kept to one statement: CONCURRENTLY can't run in a transaction. Leads with club_id, so it
-- also indexes that foreign key; email_hash and created_at serve the "invited this week?" check.
create index concurrently if not exists club_invites_club_id_email_hash_idx on public.club_invites (club_id, email_hash, created_at);

-- =============================================================================
-- 20261029003102_index_club_invites_invited_by.sql
-- =============================================================================
-- Kept to one statement: CONCURRENTLY can't run in a transaction. Leads with invited_by, so it
-- also indexes that foreign key; created_at serves the "10 a day" check.
create index concurrently if not exists club_invites_invited_by_created_at_idx on public.club_invites (invited_by, created_at);

-- =============================================================================
-- 20261029003200_legal_club_invites.sql
-- =============================================================================
-- Club invites by email: the Privacy Policy says Mailgun also sends the invitations
-- members send, what the invitation shows, and that only a fingerprint of the address
-- is kept for 30 days (src/data/legalPages.json has the same change). The edit trigger
-- keeps the old versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$telling you when a book you set Remind me on is out), so it receives your email address and each email's contents.$lw$, $lw$telling you when a book you set Remind me on is out) and the book club invitations members send, so it receives the address each email goes to and the email's contents.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%telling you when a book you set Remind me on is out), so it receives your email address and each email's contents.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Book club posts are seen by the club's members. Lists you share$lw$, $lw$Book club posts are seen by the club's members. If you invite someone to a club by email, the invitation shows them your display name and the club's name, book and finish date; we send it through Mailgun and keep only a one-way fingerprint of their address for 30 days (so the same address isn't invited again within a week), never the address itself. Lists you share$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Book club posts are seen by the club's members. Lists you share%$lw$;

-- =============================================================================
-- 20261030003300_notifications_seen.sql
-- =============================================================================
-- The notification bell (story 56).
--
-- The bell counts what's new for a profile: books from its reminders that came
-- out since it last opened the bell, and its account's unread club posts (which
-- keep their own read state, club_members.last_read_at). Opening the bell sets
-- notifications_seen_at through mark_notifications_seen(), at the database's
-- time, so every device signed in to the profile agrees on what's been seen.

alter table public.reader_profiles
  add column notifications_seen_at timestamptz;

grant select (notifications_seen_at) on public.reader_profiles to authenticated;

-- Marks the profile's notifications seen for the caller and returns when. Only
-- the caller's own profiles change (RLS on reader_profiles, including the
-- two-step sign-in policy); a profile that isn't theirs returns null.
create function public.mark_notifications_seen(p_profile_id uuid)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  update public.reader_profiles
     set notifications_seen_at = now()
   where id = p_profile_id and account_id = (select auth.uid())
  returning notifications_seen_at;
$$;

grant update (notifications_seen_at) on public.reader_profiles to authenticated;

revoke execute on function public.mark_notifications_seen(uuid) from public, anon;
grant execute on function public.mark_notifications_seen(uuid) to authenticated;

-- =============================================================================
-- 20261030003400_author_news.sql
-- =============================================================================
-- New books from authors you follow (story 35's notifications).
--
-- Once a week the author-news function (pg_cron, with a secret kept in Vault,
-- like release-emails) asks Google Books for the newest titles of every author a
-- profile follows and keeps those published in the last 30 days. Each becomes an
-- author_news row for every profile following that author (not Kids profiles,
-- which see only the sample catalog), unless the book is already in the
-- account's library. The bell counts rows newer than the profile last looked;
-- the account holder gets one email a week listing them, unless they turned it
-- off in Account → Preferences (account_private.author_emails). Rows go after
-- 60 days. The checks run daily (each author about once a week); the email goes
-- on Mondays.
--
-- * author_checks: when each followed name was last asked about. Server only.
-- * authors_to_check(): the followed names due a check (none in the last six
--   days), longest-waiting first.
-- * record_author_news(): records one author's new books for their followers.
-- * claim_author_emails(): marks unemailed rows from the last two weeks as
--   emailed and returns them with the address; the function hands back any it
--   couldn't send. All three are for the service role only.

alter table public.account_private add column author_emails boolean not null default true;
grant select (author_emails), update (author_emails) on public.account_private to authenticated;

create table public.author_news (
  profile_id uuid not null,
  user_id    uuid not null,
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  title      text not null check (char_length(title) between 1 and 300),
  -- The followed name, as the profile follows it.
  author     text not null check (char_length(author) between 1 and 100),
  -- Google's publishedDate: YYYY-MM or YYYY-MM-DD.
  published  text not null check (published ~ '^\d{4}-\d{2}(-\d{2})?$'),
  found_at   timestamptz not null default now(),
  emailed_at timestamptz,
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.author_news enable row level security;

create policy "Readers see their profiles' new books" on public.author_news for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.author_news as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.author_news from anon, authenticated;
grant select (profile_id, volume_id, title, author, published, found_at) on public.author_news to authenticated;

create table public.author_checks (
  name_key   text primary key check (name_key = lower(name_key) and char_length(name_key) between 1 and 100),
  checked_at timestamptz not null default now()
);
alter table public.author_checks enable row level security;
revoke all on public.author_checks from anon, authenticated;

create or replace function public.authors_to_check(max_count integer default 100)
returns table (name text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name
  from (
    select distinct on (lower(f.name)) f.name
    from public.follows f
    join public.reader_profiles rp on rp.id = f.profile_id and rp.age_rating <> 'kids'
    where f.kind = 'author'
    order by lower(f.name), f.created_at
  ) f
  left join public.author_checks c on c.name_key = lower(f.name)
  where c.checked_at is null or c.checked_at < now() - interval '6 days'
  order by c.checked_at nulls first, lower(f.name)
  limit least(greatest(coalesce(max_count, 100), 1), 300);
$$;

-- p_books: [{ "id": volume id, "title": text, "published": "YYYY-MM[-DD]" }], already
-- checked by the function. Returns how many rows were added.
create or replace function public.record_author_news(p_name text, p_books jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  insert into public.author_checks (name_key, checked_at) values (lower(p_name), now())
  on conflict (name_key) do update set checked_at = excluded.checked_at;

  insert into public.author_news (profile_id, user_id, volume_id, title, author, published)
  select f.profile_id, f.user_id, b.id, left(b.title, 300), f.name, b.published
  from public.follows f
  join public.reader_profiles rp on rp.id = f.profile_id and rp.age_rating <> 'kids'
  cross join jsonb_to_recordset(coalesce(p_books, '[]'::jsonb)) as b(id text, title text, published text)
  where f.kind = 'author'
    and lower(f.name) = lower(p_name)
    and not exists (select 1 from public.library_items l where l.user_id = f.user_id and l.volume_id = b.id)
  on conflict do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

create or replace function public.claim_author_emails(max_count integer default 500)
returns table (
  user_id      uuid,
  email        text,
  account_name text,
  profile_id   uuid,
  profile_name text,
  volume_id    text,
  title        text,
  author       text,
  published    text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select n.profile_id, n.user_id, n.volume_id
    from public.author_news n
    join public.account_private a on a.user_id = n.user_id and a.author_emails
    join auth.users u on u.id = n.user_id and u.email is not null and u.email_confirmed_at is not null
    where n.emailed_at is null
      and n.found_at > now() - interval '14 days'
    order by n.user_id, n.found_at
    limit least(greatest(coalesce(max_count, 500), 1), 1000)
    for update of n skip locked
  ), claimed as (
    update public.author_news n
    set emailed_at = now()
    from due
    where n.profile_id = due.profile_id and n.user_id = due.user_id and n.volume_id = due.volume_id
    returning n.user_id, n.profile_id, n.volume_id, n.title, n.author, n.published
  )
  select c.user_id, u.email::text, p.display_name, c.profile_id, rp.name, c.volume_id, c.title, c.author, c.published
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id
  left join public.reader_profiles rp on rp.id = c.profile_id
  order by c.user_id, c.author, c.published desc, c.title;
end;
$$;

revoke execute on function public.authors_to_check(integer), public.record_author_news(text, jsonb), public.claim_author_emails(integer) from public, anon, authenticated;
grant execute on function public.authors_to_check(integer), public.record_author_news(text, jsonb), public.claim_author_emails(integer) to service_role;

-- The secret the cron job sends and the function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'author_news_secret', 'Sent by the author-news cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'author_news_secret');

create or replace function public.author_news_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'author_news_secret';
$$;
revoke execute on function public.author_news_secret() from public, anon, authenticated;
grant execute on function public.author_news_secret() to service_role;

-- task: 'check' (ask Google about the authors due a check) or 'email' (send the week's emails).
create or replace function private.call_author_news(task text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'author_news_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/author-news',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := jsonb_build_object('task', task),
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_author_news(text) from public, anon, authenticated;

-- Every day at 08:30 UTC, up to 100 authors not checked in the last six days: each author
-- is checked about once a week, however many are followed. The bell shows what's found
-- straight away; the email goes once a week, on Mondays at 09:30 UTC.
select cron.schedule('author-news-check', '30 8 * * *', $$select private.call_author_news('check')$$);
select cron.schedule('author-news-email', '30 9 * * 1', $$select private.call_author_news('email')$$);

-- New books stay in the bell for 60 days.
select cron.schedule('author-news-cleanup', '45 3 * * *', $$delete from public.author_news where found_at < now() - interval '60 days'$$);

-- =============================================================================
-- 20261030003401_index_author_news_unemailed.sql
-- =============================================================================
-- claim_author_emails() looks for rows not emailed yet, by account. Its own migration:
-- CREATE INDEX CONCURRENTLY can't run inside a transaction.
create index concurrently if not exists author_news_unemailed on public.author_news (user_id, found_at) where emailed_at is null;

-- =============================================================================
-- 20261030003402_legal_author_news.sql
-- =============================================================================
-- New books from followed authors and the deletion email: the Privacy Policy says Mailgun
-- also sends the weekly email of new books from followed authors and the email confirming an
-- account was deleted, that the account keeps whether the weekly email is wanted (and it can
-- be turned off), that the new books found are kept for 60 days, and that our server sends
-- Google Books the names of followed authors, never who follows them
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old versions; a
-- page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$telling you when a book you set Remind me on is out) and the book club invitations members send$lw$, $lw$telling you when a book you set Remind me on is out, a weekly list of new books from authors you follow, and confirming that your account was deleted) and the book club invitations members send$lw$)::jsonb
where sections::text like $lw$%telling you when a book you set Remind me on is out) and the book club invitations members send%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$whether you'd like marketing emails and emails when a reminded book is out, when you accepted the Terms$lw$, $lw$whether you'd like marketing emails, emails when a reminded book is out and weekly emails about new books from authors you follow, when you accepted the Terms$lw$)::jsonb
where sections::text like $lw$%whether you'd like marketing emails and emails when a reminded book is out, when you accepted the Terms%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$the authors and narrators you follow, release reminders,$lw$, $lw$the authors and narrators you follow (and, for 60 days, the new books we find by the authors you follow), release reminders,$lw$)::jsonb
where sections::text like $lw$%the authors and narrators you follow, release reminders,%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$(emails about books you set Remind me on can be turned off separately in Account)$lw$, $lw$(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account)$lw$)::jsonb
where sections::text like $lw$%(emails about books you set Remind me on can be turned off separately in Account)%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$sends it search words and book ids, never who's asking.$lw$, $lw$sends it search words, book ids and the names of authors people follow, never who's asking.$lw$)::jsonb
where sections::text like $lw$%sends it search words and book ids, never who's asking.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$which sends only the search words and book ids, never who's asking.$lw$, $lw$which sends only the search words, book ids and the names of authors people follow, never who's asking.$lw$)::jsonb
where sections::text like $lw$%which sends only the search words and book ids, never who's asking.%$lw$;

-- =============================================================================
-- 20261030003500_cancel_notice.sql
-- =============================================================================
-- The 48-hour cancellation rule (Terms and Return Policy): a member must cancel at least
-- 48 hours before the next billing date to stop that charge. Cancelling later still ends
-- the membership, but after one more paid month; nothing is refunded either way.
--
-- subscriptions.cancel_at is when an ending membership ends: the period's end
-- (current_period_end) given 48 hours' notice, or a month after it otherwise. Written by
-- manage-account and the stripe-webhook function (from the Stripe subscription's
-- cancel_at); the browser only reads it. cancel_at_period_end stays true for any ending
-- membership. Memberships already ending end at their period's end.

alter table public.subscriptions add column cancel_at timestamptz;

update public.subscriptions
set cancel_at = current_period_end
where cancel_at_period_end and cancel_at is null;

grant select (cancel_at) on public.subscriptions to authenticated;

-- =============================================================================
-- 20261030003501_legal_cancel_notice.sql
-- =============================================================================
-- The 48-hour cancellation rule (migration 3500): the Terms and the Return Policy say a member
-- must cancel at least 48 hours before the next billing date to stop that charge, that
-- cancelling later means one more monthly charge before the membership ends, and that
-- nothing is refunded (src/data/legalPages.json has the same change). The edit trigger keeps
-- the old versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Your cancellation will take effect at the end of the current paid term.$lw$, $lw$To stop the next charge, cancel at least 48 hours before your next billing date: your cancellation then takes effect at the end of the current paid term. If you cancel less than 48 hours before your billing date, that charge still goes through and your cancellation takes effect at the end of the term it pays for. No refunds are given for any part of a term.$lw$)::jsonb
where sections::text like $lw$%Your cancellation will take effect at the end of the current paid term.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for.$lw$, $lw$until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds.$lw$)::jsonb
where sections::text like $lw$%until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$You can cancel at any time from Account; your plan stays active until the end of the period you've paid for, and you won't be charged again.$lw$, $lw$You can cancel at any time from Account. Cancel at least 48 hours before your next billing date and your plan stays active until the end of the period you've paid for, and you won't be charged again. If you cancel less than 48 hours before your billing date, that charge still goes through (it isn't refunded) and your plan ends at the end of the month it pays for.$lw$)::jsonb
where sections::text like $lw$%You can cancel at any time from Account; your plan stays active until the end of the period you've paid for, and you won't be charged again.%$lw$;

-- =============================================================================
-- 20261030003600_staff_role_sales.sql
-- =============================================================================
-- A Sales staff role. Its own migration: a new enum value can't be used in the transaction
-- that adds it, and migration 3601 uses it. Like Developer, Customer service and Blog, no
-- tool checks it yet; it gives a complimentary membership like every staff role (3601).
alter type public.staff_role add value if not exists 'sales';

-- =============================================================================
-- 20261030003601_staff_memberships.sql
-- =============================================================================
-- Every member of staff gets a complimentary membership while they work here, not only
-- admins (migration 1800): Admin, Editor, Developer, Billing, Customer service, Blog and
-- Sales. The database still decides: subscriptions_set_complimentary() marks a membership
-- complimentary when its account holds any staff role, so it's Premium, active and never
-- billed. Granting a first role starts (or converts) it; removing the last role ends it
-- (the row is removed), so the account chooses a plan, and agrees to its renewal terms,
-- before anything could be charged. Moving between roles keeps it.
--
-- A Stripe subscription the account had keeps no hold on the row (stripe_subscription_id
-- is cleared); stripe-webhook cancels it in Stripe the next time Stripe writes about it,
-- and deletes any renewal invoice before it's charged, as it did for admins.

create or replace function private.subscriptions_set_complimentary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.complimentary := exists (select 1 from public.staff_roles where user_id = new.user_id);
  if new.complimentary then
    new.plan_id := 'premium';
    new.status := 'active';
    new.billing_day := null;
    new.cancel_at_period_end := false;
    new.current_period_end := null;
    new.cancel_at := null;
    new.gift_until := null;
    new.stripe_subscription_id := null;
  end if;
  return new;
end;
$$;

create or replace function private.sync_staff_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscriptions (user_id, plan_id, status)
    values (new.user_id, 'premium', 'active')
    on conflict (user_id) do update set updated_at = now();  -- the trigger above converts it
  elsif not exists (select 1 from public.staff_roles where user_id = old.user_id) then
    -- No longer on staff: the free membership ends and the account has no plan, so it
    -- chooses one (and agrees to its renewal terms) before anything could be charged.
    delete from public.subscriptions where user_id = old.user_id and complimentary;
  end if;
  return null;
end;
$$;
revoke execute on function private.sync_staff_membership() from public, anon, authenticated;

drop trigger if exists staff_roles_admin_granted on public.staff_roles;
drop trigger if exists staff_roles_admin_removed on public.staff_roles;
drop function if exists private.sync_admin_membership();

create trigger staff_roles_granted
  after insert on public.staff_roles
  for each row execute function private.sync_staff_membership();

create trigger staff_roles_removed
  after delete on public.staff_roles
  for each row execute function private.sync_staff_membership();

-- Staff there are now: their memberships become complimentary, and those with none get one.
update public.subscriptions s set updated_at = now()
 where not s.complimentary
   and exists (select 1 from public.staff_roles r where r.user_id = s.user_id);
insert into public.subscriptions (user_id, plan_id, status)
select distinct r.user_id, 'premium', 'active'::public.subscription_status
  from public.staff_roles r
 where not exists (select 1 from public.subscriptions s where s.user_id = r.user_id);

-- =============================================================================
-- 20261030003700_household_challenges.sql
-- =============================================================================
-- Household reading challenges (new request): a goal for a stretch of time that the
-- profiles of one account take on together, such as "5 books in November", "20 hours
-- this month" or "25 days with reading". Any profile starts one; any profile (Kids
-- included) joins or leaves; everyone in the household sees each other's progress, which
-- the app works out from each profile's reading_days. Nothing is shared outside the
-- account.
--
-- * household_challenges: the challenge, owned by the account (user_id). created_by is the
--   profile that started it, and is cleared (the challenge stays) if that profile goes.
--   Up to 20 an account (trigger). Not edited once made; deleted when done with.
-- * challenge_participants: which profiles joined. The composite keys make sure the
--   challenge and the profile belong to the same account.

create table public.household_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_by uuid,
  title      text not null check (char_length(title) between 1 and 80 and title = btrim(title)),
  kind       text not null check (kind in ('books', 'hours', 'days')),
  target     smallint not null check (target between 1 and 1000),
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 366),
  check (kind <> 'days' or target <= ends_on - starts_on + 1),
  unique (id, user_id),
  foreign key (created_by, user_id) references public.reader_profiles (id, account_id) on delete set null (created_by)
);

create table public.challenge_participants (
  challenge_id uuid not null,
  user_id      uuid not null,
  profile_id   uuid not null,
  joined_at    timestamptz not null default now(),
  -- Leads with (challenge_id, user_id), so it also indexes that foreign key.
  primary key (challenge_id, user_id, profile_id),
  foreign key (challenge_id, user_id) references public.household_challenges (id, user_id) on delete cascade,
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_challenge_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.household_challenges where user_id = new.user_id) >= 20 then
    raise exception 'A household can have up to 20 challenges' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_challenge_limit() from public, anon, authenticated;

create trigger household_challenges_limit
  before insert on public.household_challenges
  for each row execute function private.enforce_challenge_limit();

alter table public.household_challenges enable row level security;
alter table public.challenge_participants enable row level security;

create policy "Households see their challenges" on public.household_challenges for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Households start challenges" on public.household_challenges for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Households delete their challenges" on public.household_challenges for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.household_challenges as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

create policy "Households see who joined" on public.challenge_participants for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Profiles join challenges" on public.challenge_participants for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Profiles leave challenges" on public.challenge_participants for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.challenge_participants as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.household_challenges, public.challenge_participants from anon, authenticated;
grant select, delete on public.household_challenges, public.challenge_participants to authenticated;
grant insert (user_id, created_by, title, kind, target, starts_on, ends_on) on public.household_challenges to authenticated;
grant insert (challenge_id, user_id, profile_id) on public.challenge_participants to authenticated;

-- =============================================================================
-- 20261030003701_index_household_challenges_user_id.sql
-- =============================================================================
-- Indexes household_challenges.user_id (its foreign key to auth.users). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists household_challenges_user_id on public.household_challenges (user_id);

-- =============================================================================
-- 20261030003702_index_household_challenges_created_by.sql
-- =============================================================================
-- Indexes household_challenges (created_by, user_id), its foreign key to reader_profiles. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists household_challenges_created_by on public.household_challenges (created_by, user_id);

-- =============================================================================
-- 20261030003703_index_challenge_participants_profile.sql
-- =============================================================================
-- Indexes challenge_participants (profile_id, user_id), its foreign key to reader_profiles. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists challenge_participants_profile on public.challenge_participants (profile_id, user_id);

-- =============================================================================
-- 20261030003704_legal_challenges.sql
-- =============================================================================
-- Household challenges (migration 3700): the Privacy Policy's list of what we keep about
-- someone's reading names them (src/data/legalPages.json has the same change). The edit
-- trigger keeps the old version; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$release reminders, recent searches, reading goals,$lw$, $lw$release reminders, recent searches, reading goals, the household challenges your profiles start or join,$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%release reminders, recent searches, reading goals,%$lw$;

-- =============================================================================
-- 20261030003800_book_characters.sql
-- =============================================================================
-- Who's who (new request): for a public-domain title, the characters a reader has met up to
-- a chapter, each described only from the text so far. The `characters` Edge Function asks
-- Claude for a book's list at a chapter the first time anyone needs it and keeps it here, so
-- every later reader at that chapter gets the same list.
--
-- Only the function (service_role) reads and writes these rows; browser roles have no access
-- at all and go through the function. Nothing here is about any member.

create table public.book_characters (
  volume_id     text        not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- 0-based, like the reader's chapter index.
  chapter_index smallint    not null check (chapter_index between 0 and 999),
  -- [{ name, description, firstChapter }], checked by the function before it's kept.
  characters    jsonb       not null check (jsonb_typeof(characters) = 'array' and jsonb_array_length(characters) between 1 and 40),
  -- The Claude model that wrote it, so lists can be rewritten when the model changes.
  model         text        not null check (char_length(model) between 1 and 80),
  created_at    timestamptz not null default now(),
  primary key (volume_id, chapter_index)
);

alter table public.book_characters enable row level security;
revoke all on public.book_characters from public, anon, authenticated;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch it.
create policy "No browser access to who's who"
  on public.book_characters as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

-- =============================================================================
-- 20261030003801_legal_characters.sql
-- =============================================================================
-- Who's who (migration 3800): the Privacy Policy, Terms, Acceptable Use Policy and status page
-- name it among the AI features, say what Anthropic receives for it (the book's text up to
-- the reader's chapter, nothing about them) and that it isn't offered to Kids profiles
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old versions; a
-- page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Anthropic (Claude) writes book summaries and answers Ask the book questions (see section 6).$lw$, $lw$Anthropic (Claude) writes book summaries, answers Ask the book questions and writes Who's who (see section 6).$lw$)::jsonb
where sections::text like $lw$%Anthropic (Claude) writes book summaries and answers Ask the book questions (see section 6).%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Ask the book isn't offered to Kids profiles. Summaries and answers are labelled as written by AI.$lw$, $lw$Who's who: the characters you've met in a public-domain book so far. We send only the book's text up to your chapter, nothing about you, and keep the list so the next reader at that chapter gets the same one. Ask the book and Who's who aren't offered to Kids profiles. Summaries, answers and Who's who are labelled as written by AI.$lw$)::jsonb
where sections::text like $lw$%Ask the book isn't offered to Kids profiles. Summaries and answers are labelled as written by AI.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$including by trying to get around the limits on AI summaries and Ask the book.$lw$, $lw$including by trying to get around the limits on AI summaries, Ask the book and Who's who.$lw$)::jsonb
where sections::text like $lw$%including by trying to get around the limits on AI summaries and Ask the book.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Summaries and Ask the book answers are written by AI (Claude) and labelled so.$lw$, $lw$Summaries, Ask the book answers and Who's who are written by AI (Claude) and labelled so.$lw$)::jsonb
where sections::text like $lw$%Summaries and Ask the book answers are written by AI (Claude) and labelled so.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Our AI Products are the book summaries and Ask the book, which are written by Claude,$lw$, $lw$Our AI Products are the book summaries, Ask the book and Who's who, which are written by Claude,$lw$)::jsonb
where sections::text like $lw$%Our AI Products are the book summaries and Ask the book, which are written by Claude,%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$and why Ask the book is only given the text up to your place in the book.$lw$, $lw$and why Ask the book and Who's who are only given the text up to your place in the book.$lw$)::jsonb
where sections::text like $lw$%and why Ask the book is only given the text up to your place in the book.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$Summaries and Ask the book (AI): working normally.$lw$, $lw$Summaries, Ask the book and Who's who (AI): working normally.$lw$)::jsonb
where sections::text like $lw$%Summaries and Ask the book (AI): working normally.%$lw$;

-- =============================================================================
-- 20261030003900_whats_new.sql
-- =============================================================================
-- What's new (new request): a public page of what changed in LiteraryWorm (new features,
-- fixes and updates), and a monthly email of the major ones for members who ask for it.
--
-- * changelog_entries: one change each, public to read; staff with the Editor or Developer
--   role (or admins) add, edit and delete them through RLS (has_staff_role(), which also
--   needs the two-step code when it's on). `major` entries go in the monthly email.
-- * account_private.update_emails: off until the member turns it on in Account →
--   Preferences (the email is optional, so it's opt-in).
-- * whats_new_sends: which accounts have had which month's email, so each gets it once.
--   Server only.
-- * The whats-new function (pg_cron on the 1st of each month, with a secret kept in Vault,
--   like release-emails) claims accounts through claim_whats_new_emails() and emails last
--   month's major entries. Every email carries a one-click unsubscribe link signed with
--   another Vault secret (unsubscribe_secret), which the unsubscribe function checks.

create table public.changelog_entries (
  id          uuid primary key default gen_random_uuid(),
  released_on date not null,
  version     text not null check (version ~ '^[0-9]{4}\.[0-9]{1,2}(\.[0-9]{1,3})?$'),
  kind        text not null check (kind in ('feature', 'fix', 'update')),
  title       text not null check (char_length(title) between 1 and 120 and title = btrim(title)),
  body        text not null check (char_length(body) between 1 and 1000 and body = btrim(body)),
  major       boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function private.touch_changelog_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.touch_changelog_entry() from public, anon, authenticated;

create trigger changelog_entries_touch
  before update on public.changelog_entries
  for each row execute function private.touch_changelog_entry();

alter table public.changelog_entries enable row level security;

create policy "Anyone reads what's new" on public.changelog_entries for select to anon, authenticated
  using (true);
create policy "Editors and developers add to what's new" on public.changelog_entries for insert to authenticated
  with check ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')));
create policy "Editors and developers change what's new" on public.changelog_entries for update to authenticated
  using ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')))
  with check ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')));
create policy "Editors and developers delete from what's new" on public.changelog_entries for delete to authenticated
  using ((select public.has_staff_role('editor')) or (select public.has_staff_role('developer')));

revoke all on public.changelog_entries from anon, authenticated;
grant select (id, released_on, version, kind, title, body, major, created_at) on public.changelog_entries to anon, authenticated;
grant insert (released_on, version, kind, title, body, major, created_by) on public.changelog_entries to authenticated;
grant update (released_on, version, kind, title, body, major) on public.changelog_entries to authenticated;
grant delete on public.changelog_entries to authenticated;

-- The monthly email: off until the member asks for it.
alter table public.account_private add column update_emails boolean not null default false;
grant select (update_emails), update (update_emails) on public.account_private to authenticated;

create table public.whats_new_sends (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The first day of the month the email covered.
  month   date not null check (extract(day from month) = 1),
  sent_at timestamptz not null default now(),
  primary key (user_id, month)
);
alter table public.whats_new_sends enable row level security;
revoke all on public.whats_new_sends from anon, authenticated;

-- Marks up to max_count accounts that asked for the email and haven't had p_month's yet, and
-- returns them with the address; the function hands back any it couldn't send.
create or replace function public.claim_whats_new_emails(p_month date, max_count integer default 500)
returns table (user_id uuid, email text, account_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select a.user_id
    from public.account_private a
    join auth.users u on u.id = a.user_id and u.email is not null and u.email_confirmed_at is not null
    where a.update_emails
      and not exists (select 1 from public.whats_new_sends s where s.user_id = a.user_id and s.month = p_month)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 500), 1), 1000)
  ), claimed as (
    insert into public.whats_new_sends (user_id, month)
    select due.user_id, p_month from due
    on conflict do nothing
    returning whats_new_sends.user_id
  )
  select c.user_id, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id;
end;
$$;
revoke execute on function public.claim_whats_new_emails(date, integer) from public, anon, authenticated;
grant execute on function public.claim_whats_new_emails(date, integer) to service_role;

-- The secrets: one the cron job sends and the whats-new function checks, one that signs
-- unsubscribe links. 32 random bytes each, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'whats_new_secret', 'Sent by the whats-new cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'whats_new_secret');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'unsubscribe_secret', 'Signs one-click unsubscribe links in emails')
where not exists (select 1 from vault.secrets where name = 'unsubscribe_secret');

create or replace function public.whats_new_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'whats_new_secret';
$$;

create or replace function public.unsubscribe_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'unsubscribe_secret';
$$;
revoke execute on function public.whats_new_secret(), public.unsubscribe_secret() from public, anon, authenticated;
grant execute on function public.whats_new_secret(), public.unsubscribe_secret() to service_role;

create or replace function private.call_whats_new()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'whats_new_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/whats-new',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_whats_new() from public, anon, authenticated;

-- 10:00 UTC on the 1st of each month: last month's major changes. A run that's cut short
-- carries on the next day (accounts already sent are skipped), until the 3rd.
select cron.schedule('whats-new-email', '0 10 1-3 * *', $$select private.call_whats_new()$$);

-- =============================================================================
-- 20261030003901_index_changelog_entries_created_by.sql
-- =============================================================================
-- Indexes changelog_entries.created_by (its foreign key to auth.users). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists changelog_entries_created_by on public.changelog_entries (created_by);

-- =============================================================================
-- 20261030003902_seed_whats_new.sql
-- =============================================================================
-- The first What's new entries: what shipped in October 2026 (src/data/changelog.json has
-- the same, shown until the page loads and in a copy without the backend). Data only;
-- skipped for any title already there, so editors' entries are never duplicated.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select v.released_on, v.version, v.kind, v.title, v.body, v.major
from (values
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$What's new$lw$, $lw$This page: every new feature, fix and update, newest first. Turn on the monthly round-up of the biggest changes in Account → Preferences.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Who's who$lw$, $lw$In the reader of a public-domain classic, the people icon lists the characters you've met so far, with what the book has shown about them. Nobody you haven't met yet is listed, and nothing later is given away.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Import from Goodreads or StoryGraph$lw$, $lw$Bring your reading history: export it from either site and choose Import in My Library. We find each book, show you the matches, and add them with your shelves and star ratings. Books you'd already read don't count towards this year's goal.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Household reading challenges$lw$, $lw$Take on a goal together, like 5 books in November or 20 hours this month. Everyone in the household can join and see each other's progress in My Library → Goals.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Share your year$lw$, $lw$Year in Review can now be shared as a picture: your books, hours, longest streak, covers and favourite genre, in a dark or light card.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$New books from authors you follow$lw$, $lw$When an author you follow has a new book out, it shows in the bell, and a weekly email lists them. Turn the email off in Account → Preferences.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$The notification bell$lw$, $lw$The bell at the top counts what's new for your profile: books you set Remind me on that are out, new posts in your book clubs and new books from authors you follow. What you've seen is seen on every device.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Cancel at least 48 hours before your billing date$lw$, $lw$To stop the next charge, cancel at least 48 hours before your billing date. Cancelling later still ends your membership, after one more month. Account shows which applies before you confirm. No refunds.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$The price after a promo code$lw$, $lw$Account now shows what your plan will cost once a promo code stops applying.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Clearer plans and more answers$lw$, $lw$Each plan lists everything it includes, and Common questions now covers billing, pausing, gifts, audiobooks, importing, privacy and the AI features.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$A confirmation when you delete your account$lw$, $lw$After an account is deleted, we email the address to confirm what was removed and that nothing more will be charged.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$No sideways scrolling on narrow phones$lw$, $lw$The header on the home page no longer pushes Sign up off the screen while the app's font is loading.$lw$, false),
  ($lw$2026-10-29$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Invite friends to your book club by email$lw$, $lw$Send an invitation from the club's page; the email links straight to joining.$lw$, false),
  ($lw$2026-10-29$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$An email when a book you're waiting for comes out$lw$, $lw$Set Remind me on a book that isn't out yet, and we'll email you on the day as well as showing it on Home.$lw$, false),
  ($lw$2026-10-29$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Gift memberships$lw$, $lw$Give one, three, six or twelve months of any plan, paid once. The code never expires.$lw$, false)
) as v(released_on, version, kind, title, body, major)
where not exists (select 1 from public.changelog_entries c where c.title = v.title and c.version = v.version);

-- =============================================================================
-- 20261030003903_legal_whats_new.sql
-- =============================================================================
-- What's new (migration 3900): the Privacy Policy lists the monthly What's new email among
-- what Mailgun sends, says the account keeps whether it's wanted (off until turned on), and
-- that it has a one-click unsubscribe link (src/data/legalPages.json has the same change).
-- The edit trigger keeps the old versions; a page an editor has reworded since is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a weekly list of new books from authors you follow, and confirming that your account was deleted)$lw$, $lw$a weekly list of new books from authors you follow, a monthly round-up of what's new in LiteraryWorm if you turn it on, and confirming that your account was deleted)$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%a weekly list of new books from authors you follow, and confirming that your account was deleted)%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$emails when a reminded book is out and weekly emails about new books from authors you follow, when you accepted the Terms$lw$, $lw$emails when a reminded book is out, weekly emails about new books from authors you follow and the monthly What's new email (off until you turn it on), when you accepted the Terms$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%emails when a reminded book is out and weekly emails about new books from authors you follow, when you accepted the Terms%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account)$lw$, $lw$(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account, and the monthly What's new email has a one-click unsubscribe link that works without signing in)$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%(emails about books you set Remind me on and new books from authors you follow can be turned off separately in Account)%$lw$;

-- =============================================================================
-- 20261030004000_whats_new_genres.sql
-- =============================================================================
-- What's new: the twelve genres added to Home and Search (src/data/changelog.json has the
-- same). Data only; skipped if an editor has already added it.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$More genres to browse and search$lw$, $lw$Alongside Technology, Adventure, Sci-Fi, Fiction, Non-Fiction and Horror, you can now browse and search Fantasy, Mystery, Thriller, Romance, Classics, Historical Fiction, Young Adult, Children's, Biography & Memoir, History, Science, Self-Help and Poetry.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More genres to browse and search$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004100_plan_limits.sql
-- =============================================================================
-- Plan limits: each plan's audiobook hours a month and offline devices (public.plans
-- audio_hours and download_devices, shown on the plan cards) are now kept.
--
-- Listening: the app pauses the player once the account's listening this month reaches the
-- plan's hours. listening_minutes_between() gives it the account's saved listening (every
-- profile, every device) so time on another device counts too.
--
-- Offline devices: a device that keeps books with Read offline holds one of the plan's
-- device places. claim_offline_device() gives a place (or confirms one the device already
-- has) and refuses when the plan's places are taken, listing the devices holding them so
-- the member can free one. A device whose place is freed clears its offline books the next
-- time it opens. Staff memberships are Premium (5 devices, unlimited listening).

-- The account's listening, in whole minutes, from p_from to p_to (at most a month and a bit).
create or replace function public.listening_minutes_between(p_from date, p_to date)
returns integer
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 31 then
    raise exception 'p_from and p_to must be at most 31 days apart' using errcode = 'check_violation';
  end if;
  return coalesce((
    select sum(d.listening_minutes)::integer
    from public.reading_days d
    where d.user_id = (select auth.uid()) and d.day between p_from and p_to
  ), 0);
end;
$$;

revoke execute on function public.listening_minutes_between(date, date) from public, anon;
grant execute on function public.listening_minutes_between(date, date) to authenticated;

create table public.offline_devices (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- "Chrome on Windows": worked out from the browser, shown when choosing one to free.
  label        text not null check (char_length(btrim(label)) between 1 and 60),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
-- The index for user_id (the foreign key and RLS) is in the 4101 migration.

alter table public.offline_devices enable row level security;

create policy "Members see their own offline devices" on public.offline_devices for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members free their own offline devices" on public.offline_devices for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.offline_devices as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Places are only taken through claim_offline_device(), which checks the plan.
revoke all on public.offline_devices from anon, authenticated;
grant select, delete on public.offline_devices to authenticated;

create or replace function public.claim_offline_device(p_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_limit smallint;
  v_plan  text;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null or p_label is null or char_length(btrim(p_label)) not between 1 and 60 then
    raise exception 'a device id and a label of 1 to 60 characters are needed' using errcode = 'check_violation';
  end if;
  -- One claim at a time per account, so two devices can't both take the last place.
  perform pg_advisory_xact_lock(hashtextextended('offline_devices:' || v_user::text, 0));

  update public.offline_devices set last_seen_at = now(), label = btrim(p_label)
  where id = p_id and user_id = v_user;
  if found then
    return jsonb_build_object('status', 'ok');
  end if;
  if exists (select 1 from public.offline_devices where id = p_id) then
    raise exception 'that device id is taken' using errcode = 'unique_violation';
  end if;

  -- Without a membership row, the smallest plan's places.
  select p.download_devices, p.id into v_limit, v_plan
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.user_id = v_user;
  if v_limit is null then
    select p.download_devices, p.id into v_limit, v_plan from public.plans p where p.id = 'basic';
  end if;

  if (select count(*) from public.offline_devices where user_id = v_user) >= v_limit then
    return jsonb_build_object(
      'status', 'full',
      'plan_id', v_plan,
      'limit', v_limit,
      'devices', coalesce((
        select jsonb_agg(jsonb_build_object('id', d.id, 'label', d.label, 'last_seen_at', d.last_seen_at) order by d.last_seen_at desc)
        from public.offline_devices d where d.user_id = v_user
      ), '[]'::jsonb)
    );
  end if;

  insert into public.offline_devices (id, user_id, label) values (p_id, v_user, btrim(p_label));
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke execute on function public.claim_offline_device(uuid, text) from public, anon;
grant execute on function public.claim_offline_device(uuid, text) to authenticated;

-- =============================================================================
-- 20261030004101_index_offline_devices_user_id.sql
-- =============================================================================
create index concurrently if not exists offline_devices_user_id_idx on public.offline_devices (user_id);

-- =============================================================================
-- 20261030004102_legal_plan_limits.sql
-- =============================================================================
-- Plan limits (migration 4100) and staff memberships in the policies: the Terms say what each
-- plan includes and that staff are never billed; the Privacy and Cookie Policies cover the
-- offline device list and the note kept beside offline books; Help says where to see usage.
-- src/data/legalPages.json has the same change. A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$"This is not a demo app anymore: your LiteraryWorm account is a live account. You'll be billed monthly until you cancel. Add a payment method in Account → Plan and billing to continue your membership. You can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account."$lw$, $lw$"This is not a demo app anymore: your LiteraryWorm account is a live account. You'll be billed monthly until you cancel. Add a payment method in Account → Plan and billing to continue your membership. You can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account.", "Plan limits. Each plan includes the audiobook listening and offline devices shown on the Plans page: Basic, 5 hours a month and 1 device; Standard, 30 hours and 3 devices; Premium, unlimited listening and 5 devices. Listening is counted for the whole household on every device. When a month's hours are used up, audiobooks pause until the 1st of the next month; reading carries on, and you can change plan at any time. Each device that saves books with Read offline holds one of the plan's places: free one in Account → Plan and billing to use another device, and the freed device's offline books are removed the next time it opens LiteraryWorm.", "Staff memberships. People with a LiteraryWorm staff role (admin, editor, developer, billing, customer service, blog or sales) have a complimentary Premium membership for as long as they hold a role. It's never billed and can't be paused or cancelled; it ends when their last staff role is removed, and they can then choose a plan like any member."$lw$)::jsonb
where slug = $lw$terms$lw$
  and strpos(sections::text, $lw$"This is not a demo app anymore: your LiteraryWorm account is a live account. You'll be billed monthly until you cancel. Add a payment method in Account → Plan and billing to continue your membership. You can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account."$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"Devices: while you're signed in, a short label for each open copy of the app (such as \"Chrome on Windows\") so you can send a book to another device."$lw$, $lw$"Devices: while you're signed in, a short label for each open copy of the app (such as \"Chrome on Windows\") so you can send a book to another device. For each device that keeps books with Read offline, the same kind of label and when it was last used, so your plan's offline devices can be counted and you can free one."$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$"Devices: while you're signed in, a short label for each open copy of the app (such as \"Chrome on Windows\") so you can send a book to another device."$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"Books you save for offline: when you choose Read offline, the book's text, and its audio if you ask, are kept on your device until you remove them from the book's page."$lw$, $lw$"Books you save for offline: when you choose Read offline, the book's text, and its audio if you ask, are kept on your device until you remove them from the book's page. Next to them the app keeps a small note of which account's offline place this device holds (a random id, not your name or email), so the place can be freed from another device; it goes when the books do."$lw$)::jsonb
where slug = $lw$cookies$lw$
  and strpos(sections::text, $lw$"Books you save for offline: when you choose Read offline, the book's text, and its audio if you ask, are kept on your device until you remove them from the book's page."$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$"Each person at home can have their own profile, with its own library and recommendations. Lock a profile with a PIN, set daily limits for younger readers, and change your plan, password or emails in Account. You can cancel or pause online at any time."$lw$, $lw$"Each person at home can have their own profile, with its own library and recommendations. Lock a profile with a PIN, set daily limits for younger readers, and change your plan, password or emails in Account. You can cancel or pause online at any time.", "Your plan includes some hours of audiobooks a month for the household (Premium has no limit) and a number of devices that can keep books offline. Account → Plan and billing shows how much you've used this month and which devices hold offline places, and lets you free one."$lw$)::jsonb
where slug = $lw$help$lw$
  and strpos(sections::text, $lw$"Each person at home can have their own profile, with its own library and recommendations. Lock a profile with a PIN, set daily limits for younger readers, and change your plan, password or emails in Account. You can cancel or pause online at any time."$lw$) > 0;

-- =============================================================================
-- 20261030004103_whats_new_plan_limits.sql
-- =============================================================================
-- What's new: plan limits (migration 4100) and favourite genres from the full list
-- (src/data/changelog.json has the same). Data only; skipped if an editor added them already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select v.released_on, v.version, v.kind, v.title, v.body, v.major
from (values
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Plan limits on listening and offline devices$lw$, $lw$Each plan's audiobook hours and offline devices now apply: Basic 5 hours a month and 1 device, Standard 30 hours and 3 devices, Premium unlimited listening and 5 devices. Account → Plan and billing shows this month's listening and lets you free a device.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Favourite genres from the full list$lw$, $lw$Pick favourites from all nineteen genres when you set up or edit a profile. Up to two that aren't already on Home get a row of their own there, and more of our own titles are tagged Thriller, Historical Fiction and Fantasy.$lw$, false)
) as v(released_on, version, kind, title, body, major)
where not exists (select 1 from public.changelog_entries c where c.title = v.title and c.version = v.version);

-- =============================================================================
-- 20261030004200_member_lookup.sql
-- =============================================================================
-- Member lookup for customer service: a staff member with the customer_service role (or an
-- admin), signed in with two-step sign-in when they use it, looks up one account by its email
-- to answer a question such as "why did my audiobook stop?". It returns only what support
-- needs: the plan and billing state, how many profiles, this month's listening against the
-- plan, and the devices holding offline places. Never the member's library, reading, notes,
-- searches or Stripe ids, and nothing it can change. Every lookup is recorded in
-- support_lookups (admins can read it), and each staff member may make 60 an hour.

create table public.support_lookups (
  id           bigint generated always as identity primary key,
  staff_id     uuid references auth.users (id) on delete set null,
  member_id    uuid references auth.users (id) on delete set null,
  looked_up_at timestamptz not null default now()
);
-- Indexes for staff_id and member_id (foreign keys) are in the 4201 and 4202 migrations.

alter table public.support_lookups enable row level security;

create policy "Admins read the lookup record" on public.support_lookups for select to authenticated
  using ((select public.has_staff_role('admin')));
create policy "Two-step sign-in when turned on" on public.support_lookups as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Rows are written only by support_member_lookup().
revoke all on public.support_lookups from anon, authenticated;
grant select on public.support_lookups to authenticated;

create or replace function public.support_member_lookup(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff  uuid := (select auth.uid());
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_member auth.users%rowtype;
  v_sub    public.subscriptions%rowtype;
  v_plan   public.plans%rowtype;
  v_from   date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if v_staff is null or not public.has_staff_role('customer_service') or not public.second_step_done() then
    raise exception 'Only customer service staff and admins can look up members' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Enter the member''s email address' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.support_lookups where staff_id = v_staff and looked_up_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('status', 'too_many');
  end if;

  select * into v_member from auth.users where lower(email) = v_email limit 1;
  if v_member.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.support_lookups (staff_id, member_id) values (v_staff, v_member.id);

  select * into v_sub from public.subscriptions where user_id = v_member.id;
  select * into v_plan from public.plans where id = coalesce(v_sub.plan_id, 'basic');

  return jsonb_build_object(
    'status', 'ok',
    'member', jsonb_build_object(
      'name', (select display_name from public.profiles where id = v_member.id),
      'email', v_member.email,
      'joined_at', v_member.created_at,
      'email_confirmed', v_member.email_confirmed_at is not null,
      'two_step', exists (select 1 from auth.mfa_factors f where f.user_id = v_member.id and f.status = 'verified'),
      'staff', exists (select 1 from public.staff_roles r where r.user_id = v_member.id),
      'plan_id', v_sub.plan_id,
      'plan_name', case when v_sub.plan_id is null then null else v_plan.name end,
      'status', v_sub.status,
      'billing_day', v_sub.billing_day,
      'next_billing_at', v_sub.current_period_end,
      'cancel_at', coalesce(v_sub.cancel_at, case when v_sub.cancel_at_period_end then v_sub.current_period_end end),
      'gift_until', v_sub.gift_until,
      'complimentary', coalesce(v_sub.complimentary, false),
      'card_on_file', v_sub.stripe_subscription_id is not null,
      'profiles', (select count(*) from public.reader_profiles p where p.account_id = v_member.id),
      'kids_profiles', (select count(*) from public.reader_profiles p where p.account_id = v_member.id and p.age_rating = 'kids'),
      'max_profiles', v_plan.max_profiles,
      'listening_minutes', coalesce((
        select sum(d.listening_minutes) from public.reading_days d where d.user_id = v_member.id and d.day >= v_from
      ), 0),
      'audio_hours', v_plan.audio_hours,
      'download_devices', v_plan.download_devices,
      'offline_devices', coalesce((
        select jsonb_agg(jsonb_build_object('label', o.label, 'last_seen_at', o.last_seen_at) order by o.last_seen_at desc)
        from public.offline_devices o where o.user_id = v_member.id
      ), '[]'::jsonb),
      'devices_open_today', (select count(*) from public.listening_devices l where l.user_id = v_member.id and l.last_seen_at > now() - interval '1 day')
    )
  );
end;
$$;

revoke execute on function public.support_member_lookup(text) from public, anon;
grant execute on function public.support_member_lookup(text) to authenticated;

-- The record is kept for a year (daily at 03:45 UTC).
select cron.schedule('support-lookups-cleanup', '45 3 * * *',
  $job$delete from public.support_lookups where looked_up_at < now() - interval '1 year'$job$);

-- =============================================================================
-- 20261030004201_index_support_lookups_staff_id.sql
-- =============================================================================
create index concurrently if not exists support_lookups_staff_id_idx on public.support_lookups (staff_id, looked_up_at);

-- =============================================================================
-- 20261030004202_index_support_lookups_member_id.sql
-- =============================================================================
create index concurrently if not exists support_lookups_member_id_idx on public.support_lookups (member_id);

-- =============================================================================
-- 20261030004203_legal_member_lookup.sql
-- =============================================================================
-- Member lookup (migration 4200): the Privacy Policy says what customer service staff can see
-- and that every lookup is recorded (src/data/legalPages.json has the same change). A page an
-- editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$"Other members. Reading logs are public, with your display name. Book club posts are seen by the club's members. If you invite someone to a club by email, the invitation shows them your display name and the club's name, book and finish date; we send it through Mailgun and keep only a one-way fingerprint of their address for 30 days (so the same address isn't invited again within a week), never the address itself. Lists you share can be read by anyone with the link. Staff with the right access can see account details to run the service and help you."$lw$, $lw$"Other members. Reading logs are public, with your display name. Book club posts are seen by the club's members. If you invite someone to a club by email, the invitation shows them your display name and the club's name, book and finish date; we send it through Mailgun and keep only a one-way fingerprint of their address for 30 days (so the same address isn't invited again within a week), never the address itself. Lists you share can be read by anyone with the link. Staff with the right access can see account details to run the service and help you.", "Our support team. To help with a question, LiteraryWorm staff with the customer service role (and admins) can look up an account by its email address. They see the name and email, when the account was made, whether the email is confirmed and two-step sign-in is on, the plan and its billing state (never card details), how many profiles there are, this month's listening against the plan, and the devices keeping books offline. They never see your library, reading, notes, highlights or searches. Every lookup is recorded with who made it and when, and the record is deleted after a year."$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$"Other members. Reading logs are public, with your display name. Book club posts are seen by the club's members. If you invite someone to a club by email, the invitation shows them your display name and the club's name, book and finish date; we send it through Mailgun and keep only a one-way fingerprint of their address for 30 days (so the same address isn't invited again within a week), never the address itself. Lists you share can be read by anyone with the link. Staff with the right access can see account details to run the service and help you."$lw$) > 0;

-- =============================================================================
-- 20261030004204_whats_new_listening_heads_up.sql
-- =============================================================================
-- What's new: the listening heads-up and the notification label fix (src/data/changelog.json
-- has the same). Data only; skipped if an editor added them already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select v.released_on, v.version, v.kind, v.title, v.body, v.major
from (values
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$A heads-up before your listening runs out$lw$, $lw$On Basic and Standard, the player shows how much of this month's listening is left, and the bell lets you know once the household has used most of it.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$The New label in notifications$lw$, $lw$The New label on a notification now sits next to its title instead of stretching across the panel.$lw$, false)
) as v(released_on, version, kind, title, body, major)
where not exists (select 1 from public.changelog_entries c where c.title = v.title and c.version = v.version);

-- =============================================================================
-- 20261030004300_whats_new_move_up.sql
-- =============================================================================
-- What's new: moving up a plan from the limit screens (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Move up a plan in one tap$lw$, $lw$When this month's listening or your offline devices run out, the message offers the next plan up and opens its checkout straight away.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Move up a plan in one tap$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004400_yearly_billing.sql
-- =============================================================================
-- Yearly billing: each plan can be paid monthly or yearly, at ten times the monthly price (two
-- months free). Stripe holds the prices (lookup keys literaryworm_<plan>_yearly); the
-- stripe-webhook function writes subscriptions.billing_interval from the subscription's price.
-- A yearly membership renews on the date it started, can't be paused, and can't move its billing
-- day; with under 48 hours' notice a cancellation ends it a year on (the Terms say so).
-- The staff dashboard counts a twelfth of a yearly price in monthly revenue, and member lookup
-- shows the interval.

alter table public.plans
  add column yearly_price_cents integer check (yearly_price_cents > 0);
update public.plans set yearly_price_cents = price_cents * 10 where id in ('basic', 'standard', 'premium');
alter table public.plans alter column yearly_price_cents set not null;

alter table public.subscriptions
  add column billing_interval text not null default 'month' check (billing_interval in ('month', 'year'));
grant select (billing_interval) on public.subscriptions to authenticated;

create or replace function public.staff_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_role('billing') then
    raise exception 'Only billing staff and admins can see the dashboard' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'accounts', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'new_30_days', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
      'profiles', (select count(*) from public.reader_profiles),
      'kids_profiles', (select count(*) from public.reader_profiles where age_rating = 'kids')
    ),
    -- Sign-ups a week, oldest first: the last 12 weeks, this week included.
    'weekly_sign_ups', (
      select jsonb_agg(jsonb_build_object('week', w.week, 'count', (
               select count(*) from public.profiles p
                where p.created_at >= w.week and p.created_at < w.week + interval '7 days'))
             order by w.week)
        from (select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '7 days')::date as week) w
    ),
    'memberships', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'plan', p.id, 'name', p.name, 'price_cents', p.price_cents, 'currency', p.currency,
               'active', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'active' and not s.complimentary),
               'paused', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'paused'),
               'past_due', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'past_due'),
               'cancelled', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'cancelled'),
               'cancelling', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.status = 'active' and s.cancel_at_period_end),
               'complimentary', (select count(*) from public.subscriptions s where s.plan_id = p.id and s.complimentary),
               'yearly_price_cents', p.yearly_price_cents
             ) order by p.sort_order), '[]'::jsonb)
        from public.plans p
    ),
    -- A yearly membership counts a twelfth of its price each month.
    'monthly_revenue_cents', (
      select coalesce(sum(case when s.billing_interval = 'year' then round(p.yearly_price_cents / 12.0) else p.price_cents end), 0)::bigint
        from public.subscriptions s join public.plans p on p.id = s.plan_id
       where s.status = 'active' and not s.complimentary
    ),
    'yearly_memberships', (select count(*) from public.subscriptions s where s.billing_interval = 'year' and s.status = 'active' and not s.complimentary),
    'reading', jsonb_build_object(
      'active_readers_7_days', (select count(distinct profile_id) from public.reading_days where day >= current_date - 6 and minutes > 0),
      'minutes_30_days', (select coalesce(sum(minutes), 0) from public.reading_days where day >= current_date - 29),
      'listening_minutes_30_days', (select coalesce(sum(listening_minutes), 0) from public.reading_days where day >= current_date - 29),
      'books_finished_30_days', (select coalesce(sum(books_finished), 0) from public.reading_days where day >= current_date - 29)
    ),
    'clubs', jsonb_build_object(
      'running', (select count(*) from public.book_clubs where finishes_on >= current_date),
      'posts_30_days', (select count(*) from public.club_posts where created_at >= now() - interval '30 days')
    ),
    'stripe_events_to_review', (select count(*) from public.stripe_events where needs_review)
  );
end;
$$;
revoke execute on function public.staff_dashboard() from public, anon;
grant execute on function public.staff_dashboard() to authenticated;

create or replace function public.support_member_lookup(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff  uuid := (select auth.uid());
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_member auth.users%rowtype;
  v_sub    public.subscriptions%rowtype;
  v_plan   public.plans%rowtype;
  v_from   date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if v_staff is null or not public.has_staff_role('customer_service') or not public.second_step_done() then
    raise exception 'Only customer service staff and admins can look up members' using errcode = 'insufficient_privilege';
  end if;
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+$' then
    raise exception 'Enter the member''s email address' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.support_lookups where staff_id = v_staff and looked_up_at > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('status', 'too_many');
  end if;

  select * into v_member from auth.users where lower(email) = v_email limit 1;
  if v_member.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  insert into public.support_lookups (staff_id, member_id) values (v_staff, v_member.id);

  select * into v_sub from public.subscriptions where user_id = v_member.id;
  select * into v_plan from public.plans where id = coalesce(v_sub.plan_id, 'basic');

  return jsonb_build_object(
    'status', 'ok',
    'member', jsonb_build_object(
      'name', (select display_name from public.profiles where id = v_member.id),
      'email', v_member.email,
      'joined_at', v_member.created_at,
      'email_confirmed', v_member.email_confirmed_at is not null,
      'two_step', exists (select 1 from auth.mfa_factors f where f.user_id = v_member.id and f.status = 'verified'),
      'staff', exists (select 1 from public.staff_roles r where r.user_id = v_member.id),
      'plan_id', v_sub.plan_id,
      'plan_name', case when v_sub.plan_id is null then null else v_plan.name end,
      'status', v_sub.status,
      'billing_interval', v_sub.billing_interval,
      'billing_day', v_sub.billing_day,
      'next_billing_at', v_sub.current_period_end,
      'cancel_at', coalesce(v_sub.cancel_at, case when v_sub.cancel_at_period_end then v_sub.current_period_end end),
      'gift_until', v_sub.gift_until,
      'complimentary', coalesce(v_sub.complimentary, false),
      'card_on_file', v_sub.stripe_subscription_id is not null,
      'profiles', (select count(*) from public.reader_profiles p where p.account_id = v_member.id),
      'kids_profiles', (select count(*) from public.reader_profiles p where p.account_id = v_member.id and p.age_rating = 'kids'),
      'max_profiles', v_plan.max_profiles,
      'listening_minutes', coalesce((
        select sum(d.listening_minutes) from public.reading_days d where d.user_id = v_member.id and d.day >= v_from
      ), 0),
      'audio_hours', v_plan.audio_hours,
      'download_devices', v_plan.download_devices,
      'offline_devices', coalesce((
        select jsonb_agg(jsonb_build_object('label', o.label, 'last_seen_at', o.last_seen_at) order by o.last_seen_at desc)
        from public.offline_devices o where o.user_id = v_member.id
      ), '[]'::jsonb),
      'devices_open_today', (select count(*) from public.listening_devices l where l.user_id = v_member.id and l.last_seen_at > now() - interval '1 day')
    )
  );
end;
$$;

revoke execute on function public.support_member_lookup(text) from public, anon;
grant execute on function public.support_member_lookup(text) to authenticated;


-- =============================================================================
-- 20261030004401_legal_yearly_billing.sql
-- =============================================================================
-- Yearly billing (migration 4400): the Terms and the Return Policy say members can pay yearly, how a
-- yearly plan renews and is cancelled, and how moving between monthly and yearly works
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$LiteraryWorm is a live service: when you choose a plan, you're billed monthly through Stripe until you cancel.$lw$, $lw$LiteraryWorm is a live service: when you choose a plan, you're billed monthly or yearly (as you choose) through Stripe until you cancel.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$LiteraryWorm is a live service: when you choose a plan, you're billed monthly through Stripe until you cancel.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Billing and renewal. Your subscription will continue and automatically renew each month on your billing day unless canceled.$lw$, $lw$Billing and renewal. Your subscription will continue and automatically renew each month on your billing day (or, if you pay yearly, each year on the date your year started) unless canceled.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$Billing and renewal. Your subscription will continue and automatically renew each month on your billing day unless canceled.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Plans renew automatically each month on your billing day until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds. You can change your billing day (the 1st to the 28th), and pause and resume, from Account.$lw$, $lw$Plans renew automatically each month on your billing day until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds. You can change your billing day (the 1st to the 28th), and pause and resume, from Account. Yearly plans cost ten times the monthly price, start the day you pay and renew on that date each year until you cancel; we remind you in the app 30 days before. The same 48 hours' notice applies, so cancelling later means one more yearly charge. Moving from monthly to yearly starts the year at once, with the unused part of the month taken off its price; moving a yearly plan to a bigger plan charges the difference for the rest of the year straight away, and to a smaller one takes effect at renewal with no credit. Yearly plans can't be paused, change their billing day, or move to monthly billing until the year ends.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$Plans renew automatically each month on your billing day until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds. You can change your billing day (the 1st to the 28th), and pause and resume, from Account.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$You'll be billed monthly until you cancel. Add a payment method in Account → Plan and billing to continue your membership. You can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account.$lw$, $lw$You'll be billed monthly, or yearly if you choose, until you cancel. Add a payment method in Account → Plan and billing to continue your membership. On monthly billing you can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account; a yearly plan can be cancelled at any time, but not paused.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$You'll be billed monthly until you cancel. Add a payment method in Account → Plan and billing to continue your membership. You can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account.$lw$) > 0;

-- =============================================================================
-- 20261030004402_whats_new_yearly_billing.sql
-- =============================================================================
-- What's new: pay yearly, two months free (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Pay yearly, two months free$lw$, $lw$Every plan can now be paid yearly, at ten times the monthly price. Choose Yearly on Plans, or switch from monthly at any time: your year starts straight away, with the unused part of the month taken off. The bell reminds you 30 days before your year renews.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Pay yearly, two months free$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004500_whats_new_goal_alerts.sql
-- =============================================================================
-- What's new: goals and streaks in the bell (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Goals and streaks in the bell$lw$, $lw$The bell now tells you when a streak of three days or more ends tonight (from 6 pm, until you read), when you're one or two books from this year's goal, and when you reach it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Goals and streaks in the bell$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004501_whats_new_author_search.sql
-- =============================================================================
-- What's new: search by author (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Search by author$lw$, $lw$Search can now find books by who wrote them: choose Author above the search box and type any part of a name, such as tolkien or le guin. Title search works as before.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Search by author$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004502_whats_new_footer.sql
-- =============================================================================
-- What's new: a tidier footer (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$A tidier footer$lw$, $lw$The links at the foot of every page are now grouped under Explore, Help, Your privacy and Legal.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A tidier footer$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004600_kids_report.sql
-- =============================================================================
-- Kids reading report (follow-up): each week, the grown-ups see how every Kids profile read
-- in Account → Family (worked out in the browser from reading_days), and can ask for the same
-- by email on Monday mornings.
--
-- * account_private.kids_report_emails: off until the member turns it on (opt-in).
-- * kids_report_sends: which accounts have had which week's email, so each gets it once.
--   Server only.
-- * claim_kids_report_emails() marks accounts that asked for it, have a Kids profile and
--   haven't had this week's; kids_report_week() returns each Kids profile's week (time,
--   listening, days read, books finished and which). Both for the service role only.
-- * The kids-report function (pg_cron on Monday and Tuesday mornings, with a secret kept in
--   Vault, like whats-new) sends them. Each email has a one-click unsubscribe link (the
--   unsubscribe function, list "kids-report").

alter table public.account_private add column kids_report_emails boolean not null default false;
grant select (kids_report_emails), update (kids_report_emails) on public.account_private to authenticated;

create table public.kids_report_sends (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The Monday the week covered starts on.
  week    date not null check (extract(isodow from week) = 1),
  sent_at timestamptz not null default now(),
  primary key (user_id, week)
);
-- user_id leads the primary key, so the foreign key is indexed.
alter table public.kids_report_sends enable row level security;
revoke all on public.kids_report_sends from anon, authenticated;

-- Marks up to max_count accounts that asked for the report, have a Kids profile and haven't had
-- p_week's yet, and returns them with the address; the function hands back any it couldn't send.
create or replace function public.claim_kids_report_emails(p_week date, max_count integer default 500)
returns table (user_id uuid, email text, account_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select a.user_id
    from public.account_private a
    join auth.users u on u.id = a.user_id and u.email is not null and u.email_confirmed_at is not null
    where a.kids_report_emails
      and exists (select 1 from public.reader_profiles p where p.account_id = a.user_id and p.age_rating = 'kids')
      and not exists (select 1 from public.kids_report_sends s where s.user_id = a.user_id and s.week = p_week)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 500), 1), 1000)
  ), claimed as (
    insert into public.kids_report_sends (user_id, week)
    select due.user_id, p_week from due
    on conflict do nothing
    returning kids_report_sends.user_id
  )
  select c.user_id, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id;
end;
$$;
revoke execute on function public.claim_kids_report_emails(date, integer) from public, anon, authenticated;
grant execute on function public.claim_kids_report_emails(date, integer) to service_role;

-- Each Kids profile's reading from p_from to p_to (both included), by name.
create or replace function public.kids_report_week(p_user uuid, p_from date, p_to date)
returns table (profile_name text, minutes integer, listening_minutes integer, days_read integer, books_finished integer, finished_books text[])
language sql
stable
security definer
set search_path = ''
as $$
  select p.name::text,
         coalesce(sum(d.minutes), 0)::integer,
         coalesce(sum(d.listening_minutes), 0)::integer,
         count(d.day) filter (where d.minutes >= 1)::integer,
         coalesce(sum(d.books_finished), 0)::integer,
         coalesce((select array_agg(f.volume_id order by f.finished_on)
                     from public.finished_books f
                    where f.profile_id = p.id and f.user_id = p_user and f.finished_on between p_from and p_to), '{}')
  from public.reader_profiles p
  left join public.reading_days d on d.profile_id = p.id and d.user_id = p_user and d.day between p_from and p_to
  where p.account_id = p_user and p.age_rating = 'kids'
  group by p.id, p.name
  order by p.name;
$$;
revoke execute on function public.kids_report_week(uuid, date, date) from public, anon, authenticated;
grant execute on function public.kids_report_week(uuid, date, date) to service_role;

-- The secret the cron job sends and the kids-report function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kids_report_secret', 'Sent by the kids-report cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'kids_report_secret');

create or replace function public.kids_report_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'kids_report_secret';
$$;
revoke execute on function public.kids_report_secret() from public, anon, authenticated;
grant execute on function public.kids_report_secret() to service_role;

create or replace function private.call_kids_report()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'kids_report_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/kids-report',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_kids_report() from public, anon, authenticated;

-- 08:00 UTC on Monday: last week's report. A run that's cut short carries on on Tuesday
-- (accounts already sent are skipped).
select cron.schedule('kids-report-email', '0 8 * * 1,2', $$select private.call_kids_report()$$);

-- =============================================================================
-- 20261030004601_legal_kids_report.sql
-- =============================================================================
-- Kids reading report (migration 4600): the Privacy Policy lists the weekly report among the emails
-- Mailgun sends, the setting among what we keep, and its one-click unsubscribe
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a monthly round-up of what's new in LiteraryWorm if you turn it on, and confirming that your account was deleted)$lw$, $lw$a monthly round-up of what's new in LiteraryWorm if you turn it on, a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, and confirming that your account was deleted)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$a monthly round-up of what's new in LiteraryWorm if you turn it on, and confirming that your account was deleted)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$weekly emails about new books from authors you follow and the monthly What's new email (off until you turn it on)$lw$, $lw$weekly emails about new books from authors you follow, the monthly What's new email and the weekly Kids reading report (both off until you turn them on)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$weekly emails about new books from authors you follow and the monthly What's new email (off until you turn it on)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and the monthly What's new email has a one-click unsubscribe link that works without signing in)$lw$, $lw$and the monthly What's new email and the weekly Kids reading report have one-click unsubscribe links that work without signing in)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$and the monthly What's new email has a one-click unsubscribe link that works without signing in)$lw$) > 0;

-- =============================================================================
-- 20261030004602_whats_new_kids_report.sql
-- =============================================================================
-- What's new: a weekly reading report for Kids profiles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$A weekly reading report for Kids profiles$lw$, $lw$Account → Family now shows how each Kids profile read this week: time, days read and books finished. Turn on Email me this every week to get it on Monday mornings.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A weekly reading report for Kids profiles$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004700_club_meetings.sql
-- =============================================================================
-- Book club calendar (follow-up): a club's owner schedules meetings; every member sees them on
-- the club page with Add to calendar (a calendar file made in the browser), and gets an email
-- reminder in the day before.
--
-- * club_meetings: one meeting each. Members read their clubs' meetings; only the club's owner
--   adds, changes or deletes them (RLS). A meeting keeps the time zone it was scheduled in, so
--   the reminder gives the time as the owner meant it. Up to 20 upcoming a club; a start must
--   be ahead and within a year (trigger). Changing the time sends a fresh reminder.
-- * account_private.club_meeting_emails: on by default (members joined the club), off in
--   Account → Preferences or with the email's one-click unsubscribe ("club-meetings").
-- * claim_club_meeting_reminders() marks meetings starting in the next 24 hours (and more than
--   an hour away) as reminded and returns them with each member to email; release puts one back.
--   Both for the service role only. pg_cron calls the club-meetings function hourly with a
--   secret kept in Vault, like release-emails.

create table public.club_meetings (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.book_clubs (id) on delete cascade,
  starts_at   timestamptz not null,
  minutes     smallint not null default 60 check (minutes in (30, 45, 60, 90, 120)),
  title       text not null check (char_length(title) between 1 and 80 and title = btrim(title)),
  note        text check (note is null or (char_length(note) between 1 and 500 and note = btrim(note))),
  -- IANA name from the owner's browser, such as Europe/London.
  time_zone   text not null default 'UTC' check (time_zone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' and char_length(time_zone) <= 64),
  created_by  uuid references auth.users (id) on delete set null,
  reminded_at timestamptz,
  created_at  timestamptz not null default now()
);
-- Indexes for club_id (with starts_at) and created_by (foreign keys) are in the 4701 and 4702 migrations.

create or replace function private.check_club_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at then
    if new.starts_at <= now() then
      raise exception 'Choose a time that''s still to come' using errcode = 'check_violation';
    end if;
    if new.starts_at > now() + interval '366 days' then
      raise exception 'Meetings can be set up to a year ahead' using errcode = 'check_violation';
    end if;
    -- A new time gets a new reminder.
    new.reminded_at := null;
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from public.club_meetings m where m.club_id = new.club_id and m.starts_at > now()
  ) >= 20 then
    raise exception 'A club can have up to 20 upcoming meetings' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_club_meeting() from public, anon, authenticated;

create trigger club_meetings_check
  before insert or update on public.club_meetings
  for each row execute function private.check_club_meeting();

alter table public.club_meetings enable row level security;

create policy "Members see their clubs' meetings" on public.club_meetings for select to authenticated
  using ((select public.is_club_member(club_id)));
create policy "Owners schedule their clubs' meetings" on public.club_meetings for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid()))
  );
create policy "Owners change their clubs' meetings" on public.club_meetings for update to authenticated
  using (exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid())));
create policy "Owners cancel their clubs' meetings" on public.club_meetings for delete to authenticated
  using (exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid())));
create policy "Two-step sign-in when turned on" on public.club_meetings as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.club_meetings from anon, authenticated;
grant select (id, club_id, starts_at, minutes, title, note, time_zone, created_at) on public.club_meetings to authenticated;
grant insert (id, club_id, starts_at, minutes, title, note, time_zone, created_by) on public.club_meetings to authenticated;
grant update (starts_at, minutes, title, note, time_zone) on public.club_meetings to authenticated;
grant delete on public.club_meetings to authenticated;

-- Reminders: on by default, off in Preferences or from the email.
alter table public.account_private add column club_meeting_emails boolean not null default true;
grant select (club_meeting_emails), update (club_meeting_emails) on public.account_private to authenticated;

-- Marks up to max_count meetings starting in the next 24 hours (and more than an hour away) as
-- reminded, and returns one row per member who wants the email, with the club and the address.
create or replace function public.claim_club_meeting_reminders(max_count integer default 100)
returns table (
  meeting_id uuid, club_id uuid, club_name text, volume_id text, title text, note text,
  starts_at timestamptz, minutes smallint, time_zone text,
  user_id uuid, email text, member_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select m.id
    from public.club_meetings m
    where m.reminded_at is null
      and m.starts_at > now() + interval '1 hour'
      and m.starts_at <= now() + interval '24 hours'
    order by m.starts_at
    limit least(greatest(coalesce(max_count, 100), 1), 500)
    for update skip locked
  ), claimed as (
    update public.club_meetings m set reminded_at = now()
    from due where m.id = due.id
    returning m.id, m.club_id, m.title, m.note, m.starts_at, m.minutes, m.time_zone
  )
  select c.id, c.club_id, b.name, b.volume_id, c.title, c.note, c.starts_at, c.minutes, c.time_zone,
         cm.user_id, u.email::text, p.display_name
  from claimed c
  join public.book_clubs b on b.id = c.club_id
  join public.club_members cm on cm.club_id = c.club_id
  join auth.users u on u.id = cm.user_id and u.email is not null and u.email_confirmed_at is not null
  join public.account_private a on a.user_id = cm.user_id and a.club_meeting_emails
  left join public.profiles p on p.id = cm.user_id;
end;
$$;
revoke execute on function public.claim_club_meeting_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_club_meeting_reminders(integer) to service_role;

-- The secret the cron job sends and the club-meetings function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'club_meetings_secret', 'Sent by the club-meetings cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'club_meetings_secret');

create or replace function public.club_meetings_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'club_meetings_secret';
$$;
revoke execute on function public.club_meetings_secret() from public, anon, authenticated;
grant execute on function public.club_meetings_secret() to service_role;

create or replace function private.call_club_meetings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'club_meetings_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/club-meetings',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_club_meetings() from public, anon, authenticated;

-- Hourly, at 20 past: reminders for meetings in the next day.
select cron.schedule('club-meeting-reminders', '20 * * * *', $$select private.call_club_meetings()$$);

-- =============================================================================
-- 20261030004701_index_club_meetings_club_id.sql
-- =============================================================================
create index concurrently if not exists club_meetings_club_id_starts_at_idx on public.club_meetings (club_id, starts_at);

-- =============================================================================
-- 20261030004702_index_club_meetings_created_by.sql
-- =============================================================================
create index concurrently if not exists club_meetings_created_by_idx on public.club_meetings (created_by);

-- =============================================================================
-- 20261030004703_legal_club_meetings.sql
-- =============================================================================
-- Book club calendar (migration 4700): the Privacy Policy lists meeting reminders among the emails
-- Mailgun sends, the setting among what we keep, and its one-click unsubscribe
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, and confirming that your account was deleted)$lw$, $lw$a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, a reminder the day before a book club you're in meets (the club's name and book and the meeting's name, time and note), and confirming that your account was deleted)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, and confirming that your account was deleted)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$the monthly What's new email and the weekly Kids reading report (both off until you turn them on)$lw$, $lw$the monthly What's new email and the weekly Kids reading report (both off until you turn them on), book club meeting reminders (on until you turn them off)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$the monthly What's new email and the weekly Kids reading report (both off until you turn them on)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and the monthly What's new email and the weekly Kids reading report have one-click unsubscribe links that work without signing in)$lw$, $lw$and the monthly What's new email, the weekly Kids reading report and book club meeting reminders have one-click unsubscribe links that work without signing in)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$and the monthly What's new email and the weekly Kids reading report have one-click unsubscribe links that work without signing in)$lw$) > 0;

-- =============================================================================
-- 20261030004704_whats_new_club_meetings.sql
-- =============================================================================
-- What's new: book club meetings (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Book club meetings$lw$, $lw$Whoever started a book club can now schedule its meetings. Everyone in the club sees them on the club page, can add them to their calendar in one tap, and gets an email reminder the day before.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Book club meetings$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004800_club_meeting_rsvps.sql
-- =============================================================================
-- Club meeting RSVPs (follow-up to the book club calendar): each member answers a meeting with
-- Going, Maybe or Can't make it, and everyone in the club sees who's coming. Members who can't
-- make it don't get the day-before reminder email.
--
-- * club_meeting_rsvps: one answer per member per meeting. Members read their clubs' answers
--   (through club_meetings' own RLS); nobody writes the table directly: answers go through
--   answer_club_meeting(), which checks the meeting is the caller's club's and still to come.
-- * claim_club_meeting_reminders() now skips members who answered no.

create table public.club_meeting_rsvps (
  meeting_id  uuid not null references public.club_meetings (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  answer      text not null check (answer in ('yes', 'maybe', 'no')),
  answered_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
-- The index for user_id (a foreign key) is in the 4801 migration; meeting_id leads the primary key.

alter table public.club_meeting_rsvps enable row level security;

-- Visible to whoever can see the meeting (its club's members, by club_meetings' policy).
create policy "Members see answers to their clubs' meetings" on public.club_meeting_rsvps for select to authenticated
  using (exists (select 1 from public.club_meetings m where m.id = meeting_id));
create policy "Two-step sign-in when turned on" on public.club_meeting_rsvps as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.club_meeting_rsvps from anon, authenticated;
grant select (meeting_id, user_id, answer, answered_at) on public.club_meeting_rsvps to authenticated;

-- Answers a meeting for the signed-in member: 'yes', 'maybe' or 'no', or null to take the answer back.
create or replace function public.answer_club_meeting(p_meeting uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_club  uuid;
  v_start timestamptz;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to answer' using errcode = 'insufficient_privilege';
  end if;
  if p_answer is not null and p_answer not in ('yes', 'maybe', 'no') then
    raise exception 'Answer yes, maybe or no' using errcode = 'check_violation';
  end if;
  select m.club_id, m.starts_at into v_club, v_start from public.club_meetings m where m.id = p_meeting;
  if v_club is null or not exists (select 1 from public.club_members cm where cm.club_id = v_club and cm.user_id = v_user) then
    raise exception 'Only the club''s members can answer' using errcode = 'insufficient_privilege';
  end if;
  if v_start <= now() then
    raise exception 'This meeting has already started' using errcode = 'check_violation';
  end if;
  if p_answer is null then
    delete from public.club_meeting_rsvps where meeting_id = p_meeting and user_id = v_user;
  else
    insert into public.club_meeting_rsvps (meeting_id, user_id, answer)
    values (p_meeting, v_user, p_answer)
    on conflict (meeting_id, user_id) do update set answer = excluded.answer, answered_at = now();
  end if;
end;
$$;
revoke execute on function public.answer_club_meeting(uuid, text) from public, anon;
grant execute on function public.answer_club_meeting(uuid, text) to authenticated;

create or replace function public.claim_club_meeting_reminders(max_count integer default 100)
returns table (
  meeting_id uuid, club_id uuid, club_name text, volume_id text, title text, note text,
  starts_at timestamptz, minutes smallint, time_zone text,
  user_id uuid, email text, member_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select m.id
    from public.club_meetings m
    where m.reminded_at is null
      and m.starts_at > now() + interval '1 hour'
      and m.starts_at <= now() + interval '24 hours'
    order by m.starts_at
    limit least(greatest(coalesce(max_count, 100), 1), 500)
    for update skip locked
  ), claimed as (
    update public.club_meetings m set reminded_at = now()
    from due where m.id = due.id
    returning m.id, m.club_id, m.title, m.note, m.starts_at, m.minutes, m.time_zone
  )
  select c.id, c.club_id, b.name, b.volume_id, c.title, c.note, c.starts_at, c.minutes, c.time_zone,
         cm.user_id, u.email::text, p.display_name
  from claimed c
  join public.book_clubs b on b.id = c.club_id
  join public.club_members cm on cm.club_id = c.club_id
  join auth.users u on u.id = cm.user_id and u.email is not null and u.email_confirmed_at is not null
  join public.account_private a on a.user_id = cm.user_id and a.club_meeting_emails
  left join public.profiles p on p.id = cm.user_id
  -- Members who said they can't come aren't reminded.
  where not exists (
    select 1 from public.club_meeting_rsvps r
    where r.meeting_id = c.id and r.user_id = cm.user_id and r.answer = 'no'
  );
end;
$$;
revoke execute on function public.claim_club_meeting_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_club_meeting_reminders(integer) to service_role;

-- =============================================================================
-- 20261030004801_index_club_meeting_rsvps_user_id.sql
-- =============================================================================
create index concurrently if not exists club_meeting_rsvps_user_id_idx on public.club_meeting_rsvps (user_id);

-- =============================================================================
-- 20261030004802_legal_club_rsvps.sql
-- =============================================================================
-- Club meeting RSVPs (migration 4800): the Privacy Policy says members' answers are seen by the
-- club (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Things you share or add: reading logs (public, with your display name), book club posts (seen by the club's members),$lw$, $lw$Things you share or add: reading logs (public, with your display name), book club posts and whether you're coming to a club's meetings (seen by the club's members),$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$Things you share or add: reading logs (public, with your display name), book club posts (seen by the club's members),$lw$) > 0;

-- =============================================================================
-- 20261030004803_whats_new_club_rsvps.sql
-- =============================================================================
-- What's new: club meeting RSVPs (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Who's coming to club meetings$lw$, $lw$Book club meetings now ask everyone whether they're coming: Going, Maybe or Can't make it, with who's going shown on the club page. Meetings in the next day show up in the notification bell, and if you can't make one we won't send you the reminder.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Who's coming to club meetings$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030004900_yearly_to_monthly.sql
-- =============================================================================
-- Yearly to monthly at renewal (follow-up to yearly billing): a yearly member can choose monthly
-- billing from the day the year would renew. checkout puts a Stripe subscription schedule on the
-- subscription (the year as it is, then the monthly price); the stripe-webhook function records
-- the plan it moves to here, from Stripe, while the schedule is attached. Choosing yearly again
-- before then, or cancelling, drops it. Members read it; only the service role writes it.

alter table public.subscriptions add column switch_to_monthly text references public.plans (id);
-- Its foreign key index is in the 4901 migration.
grant select (switch_to_monthly) on public.subscriptions to authenticated;

-- =============================================================================
-- 20261030004901_index_subscriptions_switch_to_monthly.sql
-- =============================================================================
create index concurrently if not exists subscriptions_switch_to_monthly_idx on public.subscriptions (switch_to_monthly);

-- =============================================================================
-- 20261030004902_legal_yearly_to_monthly.sql
-- =============================================================================
-- Yearly to monthly at renewal (migration 4900): the Terms say monthly billing can be chosen at any
-- time and starts on the renewal date (src/data/legalPages.json has the same change). A page an
-- editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Yearly plans can't be paused, change their billing day, or move to monthly billing until the year ends.$lw$, $lw$Yearly plans can't be paused or change their billing day. You can choose monthly billing at any time, and it starts on your renewal date, with nothing charged or refunded before then.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$Yearly plans can't be paused, change their billing day, or move to monthly billing until the year ends.$lw$) > 0;

-- =============================================================================
-- 20261030004903_whats_new_yearly_to_monthly.sql
-- =============================================================================
-- What's new: yearly to monthly at renewal (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Yearly members can switch to monthly$lw$, $lw$If you pay yearly, you can now choose monthly billing on the Plans page. Your year carries on as it is, and monthly billing starts on your renewal date. Changed your mind? Keep yearly billing in Account.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Yearly members can switch to monthly$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005000_kids_weekly_goals.sql
-- =============================================================================
-- Weekly goals for Kids profiles (follow-up to the Kids reading report): a grown-up sets how long
-- a Kids profile aims to read or listen each week (1 to 5 hours), in the profile editor. Like the
-- daily limit it's the account holder's call, so it's set only through the manage-profile
-- function (set_weekly_goal), which re-checks the account password; the browser can read it.
-- The child sees their progress in Goals, the grown-ups in Account → Family and in the Monday
-- email, which now says whether last week's goal was reached.

alter table public.reader_profiles
  add column weekly_goal_minutes smallint check (weekly_goal_minutes in (60, 90, 120, 180, 240, 300));
grant select (weekly_goal_minutes) on public.reader_profiles to authenticated;

-- The report's rows gain the goal (the return type changes, so the function is made again).
drop function public.kids_report_week(uuid, date, date);
create function public.kids_report_week(p_user uuid, p_from date, p_to date)
returns table (
  profile_name text, minutes integer, listening_minutes integer, days_read integer, books_finished integer,
  finished_books text[], weekly_goal_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name::text,
         coalesce(sum(d.minutes), 0)::integer,
         coalesce(sum(d.listening_minutes), 0)::integer,
         count(d.day) filter (where d.minutes >= 1)::integer,
         coalesce(sum(d.books_finished), 0)::integer,
         coalesce((select array_agg(f.volume_id order by f.finished_on)
                     from public.finished_books f
                    where f.profile_id = p.id and f.user_id = p_user and f.finished_on between p_from and p_to), '{}'),
         p.weekly_goal_minutes::integer
  from public.reader_profiles p
  left join public.reading_days d on d.profile_id = p.id and d.user_id = p_user and d.day between p_from and p_to
  where p.account_id = p_user and p.age_rating = 'kids'
  group by p.id, p.name, p.weekly_goal_minutes
  order by p.name;
$$;
revoke execute on function public.kids_report_week(uuid, date, date) from public, anon, authenticated;
grant execute on function public.kids_report_week(uuid, date, date) to service_role;

-- =============================================================================
-- 20261030005001_legal_kids_weekly_goals.sql
-- =============================================================================
-- Weekly goals for Kids profiles (migration 5000): the Privacy Policy and the Children's Privacy
-- Notice list the goal among what we keep, and the Kids report email's contents
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit and player settings.$lw$, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal (Kids profiles) and player settings.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit and player settings.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$its age rating and any daily reading limit you set, and its reading:$lw$, $lw$its age rating and any daily reading limit and weekly reading goal you set, and its reading:$lw$)::jsonb
where slug in ($lw$childrens-privacy$lw$)
  and strpos(sections::text, $lw$its age rating and any daily reading limit you set, and its reading:$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(their names, reading and listening time, days read and books finished)$lw$, $lw$(their names, reading and listening time, days read, books finished and any weekly goal)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$(their names, reading and listening time, days read and books finished)$lw$) > 0;

-- =============================================================================
-- 20261030005002_whats_new_kids_weekly_goals.sql
-- =============================================================================
-- What's new: weekly goals for Kids profiles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Weekly reading goals for Kids profiles$lw$, $lw$Grown-ups can now give a Kids profile a weekly reading goal, from 1 to 5 hours, in the profile's settings. Kids see how close they are in Goals, grown-ups see it in Account → Family, and the Monday Kids reading report says whether the goal was reached.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Weekly reading goals for Kids profiles$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005100_whats_new_follow_from_search.sql
-- =============================================================================
-- What's new: follow authors from an author search (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Follow authors from search$lw$, $lw$Searching by author now lists the authors it finds above the books, with how many of the results are theirs and a Follow button, so you can follow someone without opening their page.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Follow authors from search$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005200_whats_new_gift_a_year.sql
-- =============================================================================
-- What's new: a year's gift at the yearly price (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Gift a year for the yearly price$lw$, $lw$A year's gift membership now costs the yearly price, so it comes with two months free, just like paying yearly. Gifts of 1, 3 or 6 months are still the monthly price for each month.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Gift a year for the yearly price$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005300_weekly_goals_for_everyone.sql
-- =============================================================================
-- Weekly goals for every profile, not just Kids.
--
-- A grown-up or teen profile sets its own weekly reading goal from Goals, saved straight to
-- reader_profiles.weekly_goal_minutes like its name or avatar. A Kids profile's goal is still set
-- by a grown-up through the manage-profile function (with the account password): the trigger
-- refuses the browser's role any change to a Kids profile's goal, and the function, which uses the
-- service role, isn't affected.

grant update (weekly_goal_minutes) on public.reader_profiles to authenticated;

create or replace function private.guard_kids_weekly_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.weekly_goal_minutes is distinct from old.weekly_goal_minutes
     and old.age_rating = 'kids'
     and current_user = 'authenticated' then
    raise exception 'A grown-up sets a Kids profile''s weekly goal.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_kids_weekly_goal() from public, anon, authenticated;

create trigger reader_profiles_guard_kids_weekly_goal
  before update of weekly_goal_minutes on public.reader_profiles
  for each row execute function private.guard_kids_weekly_goal();

-- =============================================================================
-- 20261030005303_whats_new_weekly_goals_for_everyone.sql
-- =============================================================================
-- What's new: a weekly goal for everyone (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$A weekly goal for everyone$lw$, $lw$Grown-up and teen profiles can now set their own weekly reading goal in Goals, from 1 to 5 hours a week, and see how close they are over the last 7 days. Kids profiles still have theirs set by a grown-up.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A weekly goal for everyone$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005400_follower_counts.sql
-- =============================================================================
-- How many reader profiles follow an author or narrator, for their public page.
--
-- follows is private to each account (RLS), so the count comes from this security-definer
-- function: a number, never who. Callable by visitors too, since author pages are public; it
-- returns no member data, so it doesn't wait for the second sign-in step.

create or replace function public.follower_count(p_kind text, p_name text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.follows
  where kind = p_kind and name = btrim(p_name);
$$;

revoke execute on function public.follower_count(text, text) from public;
grant execute on function public.follower_count(text, text) to anon, authenticated;

-- =============================================================================
-- 20261030005401_index_follows_kind_name.sql
-- =============================================================================
-- For follower_count(). Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists follows_kind_name_idx on public.follows (kind, name);

-- =============================================================================
-- 20261030005403_whats_new_follower_counts.sql
-- =============================================================================
-- What's new: see who follows an author (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$See who follows an author$lw$, $lw$Author and narrator pages now show how many readers follow them, and My Library has a new Following tab listing everyone you follow, with their pages and Unfollow.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$See who follows an author$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005500_gift_start_dates.sql
-- =============================================================================
-- A gift can be bought now to start later (for a birthday, say): its code can't be redeemed
-- before starts_on. Set by the stripe-webhook function from the Checkout Session's metadata, which
-- the checkout function checked (today to a year ahead); manage-account refuses the code until
-- that day has started anywhere. Null: from the day it was bought.

alter table public.gift_codes
  add column starts_on date check (starts_on is null or starts_on <= (created_at at time zone 'UTC')::date + 367);

grant select (starts_on) on public.gift_codes to authenticated;

-- =============================================================================
-- 20261030005503_whats_new_gift_start_dates.sql
-- =============================================================================
-- What's new: give a gift that starts later (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Give a gift that starts later$lw$, $lw$When you buy a gift membership you can now choose the day it starts, up to a year ahead, so you can buy it now for a birthday. You get the code straight away, and it can be redeemed from that day.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Give a gift that starts later$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005600_club_meeting_changes.sql
-- =============================================================================
-- Emails when a book club meeting moves or is cancelled.
--
-- The club's owner could already change a meeting's time (the update policy and grant in the
-- 4700 migration); the app now offers it. When an upcoming meeting's time changes, or an upcoming
-- meeting is cancelled, a trigger notes it in club_meeting_changes, and the club-meetings function
-- (now every 10 minutes) claims the notes with claim_club_meeting_changes() and emails the other
-- members, as it does the reminders: only to confirmed addresses, and only to members who haven't
-- turned club meeting emails off. One note per meeting until it's sent: moving it twice, or moving
-- it then cancelling it, sends one email with the latest. Meetings deleted with their club (the
-- cascade) send nothing.

create table public.club_meeting_changes (
  -- The meeting's id, not a foreign key: a cancelled meeting is gone.
  meeting_id    uuid primary key,
  club_id       uuid not null references public.book_clubs (id) on delete cascade,
  kind          text not null check (kind in ('moved', 'cancelled')),
  title         text not null,
  note          text,
  -- The time members knew, and the new one (null when cancelled).
  was_starts_at timestamptz not null,
  starts_at     timestamptz,
  minutes       smallint not null,
  time_zone     text not null,
  -- The owner who made the change gets no email about it.
  changed_by    uuid references auth.users (id) on delete set null,
  changed_at    timestamptz not null default now(),
  emailed_at    timestamptz,
  check ((kind = 'moved') = (starts_at is not null))
);
-- Indexes for club_id and changed_by (foreign keys) are in the 5601 and 5602 migrations.

-- Only the club-meetings function (service role) reads or writes it.
alter table public.club_meeting_changes enable row level security;
create policy "Two-step sign-in when turned on" on public.club_meeting_changes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
revoke all on public.club_meeting_changes from anon, authenticated;

create or replace function private.note_club_meeting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- What members will be told: the meeting as it is now (moved), or as it was (cancelled).
  m public.club_meetings := case when tg_op = 'DELETE' then old else new end;
begin
  -- Deleted with the club (a cascade, so a nested trigger): nobody to tell.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return null;
  end if;
  -- Only meetings members are still waiting for.
  if old.starts_at <= now() then
    return null;
  end if;
  insert into public.club_meeting_changes as c
    (meeting_id, club_id, kind, title, note, was_starts_at, starts_at, minutes, time_zone, changed_by)
  values (
    old.id, old.club_id, case when tg_op = 'DELETE' then 'cancelled' else 'moved' end, m.title, m.note,
    old.starts_at, case when tg_op = 'DELETE' then null else m.starts_at end, m.minutes, m.time_zone, (select auth.uid())
  )
  on conflict (meeting_id) do update set
    kind = excluded.kind, title = excluded.title, note = excluded.note,
    -- Not yet sent: members still know the first time. Already sent: they know the last one.
    was_starts_at = case when c.emailed_at is null then c.was_starts_at else excluded.was_starts_at end,
    starts_at = excluded.starts_at, minutes = excluded.minutes, time_zone = excluded.time_zone,
    changed_by = excluded.changed_by, changed_at = now(), emailed_at = null;
  -- Moved back to the time members were told: nothing to send.
  delete from public.club_meeting_changes c
  where c.meeting_id = old.id and c.kind = 'moved' and c.starts_at = c.was_starts_at and c.emailed_at is null;
  return null;
end;
$$;
revoke execute on function private.note_club_meeting_change() from public, anon, authenticated;

create trigger club_meetings_note_move
  after update of starts_at on public.club_meetings
  for each row when (old.starts_at is distinct from new.starts_at)
  execute function private.note_club_meeting_change();

create trigger club_meetings_note_cancel
  after delete on public.club_meetings
  for each row execute function private.note_club_meeting_change();

-- Marks up to max_count changes as emailed and returns one row per member to tell (not the
-- owner who made the change), with the club and the address.
create or replace function public.claim_club_meeting_changes(max_count integer default 100)
returns table (
  meeting_id uuid, club_id uuid, club_name text, volume_id text, kind text, title text, note text,
  was_starts_at timestamptz, starts_at timestamptz, minutes smallint, time_zone text,
  user_id uuid, email text, member_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select c.meeting_id
    from public.club_meeting_changes c
    where c.emailed_at is null
    order by c.changed_at
    limit least(greatest(coalesce(max_count, 100), 1), 500)
    for update skip locked
  ), claimed as (
    update public.club_meeting_changes c set emailed_at = now()
    from due where c.meeting_id = due.meeting_id
    returning c.*
  )
  select c.meeting_id, c.club_id, b.name, b.volume_id, c.kind, c.title, c.note,
         c.was_starts_at, c.starts_at, c.minutes, c.time_zone,
         cm.user_id, u.email::text, p.display_name
  from claimed c
  join public.book_clubs b on b.id = c.club_id
  join public.club_members cm on cm.club_id = c.club_id and cm.user_id is distinct from c.changed_by
  join auth.users u on u.id = cm.user_id and u.email is not null and u.email_confirmed_at is not null
  join public.account_private a on a.user_id = cm.user_id and a.club_meeting_emails
  left join public.profiles p on p.id = cm.user_id;
end;
$$;
revoke execute on function public.claim_club_meeting_changes(integer) from public, anon, authenticated;
grant execute on function public.claim_club_meeting_changes(integer) to service_role;

-- Sent notes are kept a month, then cleared.
select cron.schedule(
  'club-meeting-changes-cleanup', '40 3 * * *',
  $$delete from public.club_meeting_changes where emailed_at < now() - interval '30 days'$$
);

-- Every 10 minutes (was hourly), so a change reaches members soon after it's made. Reminders are
-- claimed once each, so running more often sends nothing twice.
select cron.schedule('club-meeting-reminders', '*/10 * * * *', $$select private.call_club_meetings()$$);

-- =============================================================================
-- 20261030005601_index_club_meeting_changes_club_id.sql
-- =============================================================================
-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_meeting_changes_club_id_idx on public.club_meeting_changes (club_id);

-- =============================================================================
-- 20261030005602_index_club_meeting_changes_changed_by.sql
-- =============================================================================
-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_meeting_changes_changed_by_idx on public.club_meeting_changes (changed_by);

-- =============================================================================
-- 20261030005603_whats_new_club_meeting_changes.sql
-- =============================================================================
-- What's new: change a club meeting's time (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Change a club meeting's time$lw$, $lw$Club owners can now change a meeting's time, length, name or note, instead of cancelling it and adding a new one. When a meeting moves or is cancelled, everyone in the club gets an email with the old and new times, unless they turned meeting emails off.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Change a club meeting's time$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005700_whats_new_yearly_offer.sql
-- =============================================================================
-- What's new: switch to yearly from the bell (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Switch to yearly from the bell$lw$, $lw$Paying monthly for nearly a year? The bell now shows what paying yearly would save on your plan, with a link to switch.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Switch to yearly from the bell$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005701_legal_meeting_changes_goals_gifts.sql
-- =============================================================================
-- Meeting change emails, weekly goals for every profile, follower counts and gift start days
-- (migrations 5300 to 5600): the Privacy Policy lists the new email and what's kept, and the
-- Return Policy says when a gift code works (src/data/legalPages.json has the same change). A page
-- an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a reminder the day before a book club you're in meets (the club's name and book and the meeting's name, time and note),$lw$, $lw$a reminder the day before a book club you're in meets, and a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note),$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$a reminder the day before a book club you're in meets (the club's name and book and the meeting's name, time and note),$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$the weekly Kids reading report and book club meeting reminders have one-click unsubscribe links$lw$, $lw$the weekly Kids reading report and book club meeting emails have one-click unsubscribe links$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$the weekly Kids reading report and book club meeting reminders have one-click unsubscribe links$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$book club meeting reminders (on until you turn them off)$lw$, $lw$book club meeting emails (reminders, and when a meeting moves or is cancelled; on until you turn them off)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$book club meeting reminders (on until you turn them off)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$daily limit, weekly goal (Kids profiles) and player settings.$lw$, $lw$daily limit, weekly goal and player settings.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$daily limit, weekly goal (Kids profiles) and player settings.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$the authors and narrators you follow (and, for 60 days,$lw$, $lw$the authors and narrators you follow (their pages show how many readers follow them, never who; and, for 60 days,$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$the authors and narrators you follow (and, for 60 days,$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$A gift code doesn't expire, works once, and can't be exchanged$lw$, $lw$A gift code doesn't expire, works once (from the day the gift starts, if the buyer chose a later day up to a year ahead), and can't be exchanged$lw$)::jsonb
where slug in ($lw$returns$lw$)
  and strpos(sections::text, $lw$A gift code doesn't expire, works once, and can't be exchanged$lw$) > 0;

-- =============================================================================
-- 20261030005800_bigger_plans.sql
-- =============================================================================
-- Bigger households: Standard now has 5 profiles and Read offline on 10 devices, Premium 12
-- profiles and 24 devices (Basic is unchanged: 1 and 1). src/data/plans.ts has the same numbers.
--
-- Profiles were capped at 5 for every plan (the plans check and the trigger's least(…, 5)); the
-- cap is now 12, Premium's. Offline device places are counted by claim_offline_device() against
-- plans.download_devices, so the new numbers apply as soon as they're saved.

alter table public.plans drop constraint plans_max_profiles_check;
alter table public.plans add constraint plans_max_profiles_check check (max_profiles between 1 and 12);

update public.plans set max_profiles = 5, download_devices = 10 where id = 'standard';
update public.plans set max_profiles = 12, download_devices = 24 where id = 'premium';

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

  select least(p.max_profiles, 12) into allowed
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

-- =============================================================================
-- 20261030005801_legal_bigger_plans.sql
-- =============================================================================
-- Bigger Standard and Premium plans (migration 5800): the Terms' plan limits list the new profile and
-- device numbers (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Each plan includes the audiobook listening and offline devices shown on the Plans page:$lw$, $lw$Each plan includes the audiobook listening, profiles and offline devices shown on the Plans page:$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$Each plan includes the audiobook listening and offline devices shown on the Plans page:$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Basic, 5 hours a month and 1 device; Standard, 30 hours and 3 devices; Premium, unlimited listening and 5 devices.$lw$, $lw$Basic, 5 hours a month, 1 profile and 1 device; Standard, 30 hours, 5 profiles and 10 devices; Premium, unlimited listening, 12 profiles and 24 devices.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$Basic, 5 hours a month and 1 device; Standard, 30 hours and 3 devices; Premium, unlimited listening and 5 devices.$lw$) > 0;

-- =============================================================================
-- 20261030005802_whats_new_bigger_plans.sql
-- =============================================================================
-- What's new: more profiles and offline devices on Standard and Premium (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$More profiles and offline devices$lw$, $lw$Standard now has 5 profiles and Read offline on 10 devices (was 3 and 3), and Premium 12 profiles and 24 devices (was 5 and 5), at the same prices. Basic is unchanged.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More profiles and offline devices$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030005900_follower_counts_for_search.sql
-- =============================================================================
-- Follower counts for an author search's authors, in one call (follower_count() does one person).
--
-- Like follower_count(): numbers, never who; callable by visitors, since search is public. At most
-- 50 names are counted (a search lists far fewer); names with no followers come back as 0.

create or replace function public.follower_counts(p_kind text, p_names text[])
returns table (name text, followers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.name, count(f.name)::integer
  from (select distinct btrim(x) as name from unnest(p_names[1:50]) as x where x is not null) as n
  left join public.follows f on f.kind = p_kind and f.name = n.name
  group by n.name;
$$;

revoke execute on function public.follower_counts(text, text[]) from public;
grant execute on function public.follower_counts(text, text[]) to anon, authenticated;

-- =============================================================================
-- 20261030006000_gift_start_reminders.sql
-- =============================================================================
-- A reminder to the buyer of a gift set to start on a later day, three days before that day.
--
-- gift_codes.reminded_at marks a gift whose buyer has been reminded (server only, never granted to
-- the browser). claim_gift_start_reminders() picks the due ones once, for the gift-reminders
-- function, which pg_cron calls each day. Only gifts bought at least four days before they start,
-- not redeemed, whose buyer still has a confirmed address. The email has no code in it.

alter table public.gift_codes add column reminded_at timestamptz;

create or replace function public.claim_gift_start_reminders(max_count integer default 200)
returns table (gift_id uuid, plan_id text, months smallint, starts_on date, email text, buyer_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select g.id
    from public.gift_codes g
    where g.reminded_at is null
      and g.redeemed_at is null
      and g.buyer_id is not null
      and g.starts_on is not null
      and g.starts_on between (now() at time zone 'utc')::date and (now() at time zone 'utc')::date + 3
      and g.starts_on >= (g.created_at at time zone 'utc')::date + 4
    order by g.starts_on
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update skip locked
  ), claimed as (
    update public.gift_codes g set reminded_at = now()
    from due where g.id = due.id
    returning g.id, g.plan_id, g.months, g.starts_on, g.buyer_id
  )
  select c.id, c.plan_id, c.months, c.starts_on, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.buyer_id and u.email is not null and u.email_confirmed_at is not null
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;
revoke execute on function public.claim_gift_start_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_start_reminders(integer) to service_role;

-- The secret the cron job sends and the gift-reminders function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gift_reminders_secret', 'Sent by the gift-reminders cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'gift_reminders_secret');

create or replace function public.gift_reminders_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gift_reminders_secret';
$$;
revoke execute on function public.gift_reminders_secret() from public, anon, authenticated;
grant execute on function public.gift_reminders_secret() to service_role;

create or replace function private.call_gift_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'gift_reminders_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/gift-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_gift_reminders() from public, anon, authenticated;

-- Daily at 15:00 UTC: morning in the Americas, afternoon in Europe.
select cron.schedule('gift-start-reminders', '0 15 * * *', $$select private.call_gift_reminders()$$);

-- =============================================================================
-- 20261030006001_whats_new_plan_room_calendar_gifts.sql
-- =============================================================================
-- What's new: this round's changes (src/data/changelog.json has the same).
-- Data only; each skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$A reminder before a gift starts$lw$, $lw$Bought a gift membership for a later day? We'll email you three days before it starts, so you remember to pass the code on. The email links to your gifts; the code itself stays on the Gifts page.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A reminder before a gift starts$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Meeting changes update your calendar$lw$, $lw$When a book club meeting moves or is cancelled, the email now comes with a calendar file. Open it and the meeting moves in your calendar, or comes out of it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Meeting changes update your calendar$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Kids report in groups$lw$, $lw$The Kids reading report in Account and the Monday email now group Kids profiles: still working on their goal, no reading yet, reading without a goal, and goal reached. Handy now that a household can have up to 12 profiles.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Kids report in groups$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Follower counts in author search$lw$, $lw$Searching by author now shows how many readers follow each author it finds, next to Follow.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Follower counts in author search$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Moving to a smaller plan$lw$, $lw$Before you move to a plan with fewer profiles or offline devices, Plans now says how many profiles to remove and devices to free, with links to do it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Moving to a smaller plan$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030006002_legal_plan_room_gift_reminders.sql
-- =============================================================================
-- This round's policy wording (src/data/legalPages.json has the same change): the Privacy Policy's
-- Mailgun list gains the meeting calendar file and the gift start reminder, and the gift data line the
-- reminder; the Return Policy says the buyer is reminded; the Terms say how to move down a plan. A page
-- an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note)$lw$, $lw$a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note, with the meeting as a calendar file)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$, and confirming that your account was deleted)$lw$, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), and confirming that your account was deleted)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$, and confirming that your account was deleted)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and whether and when it was redeemed; only the buyer$lw$, $lw$and whether and when it was redeemed (and, for a gift that starts on a later day, when we reminded the buyer); only the buyer$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$and whether and when it was redeemed; only the buyer$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead)$lw$, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; we email the buyer three days before)$lw$)::jsonb
where slug in ($lw$returns$lw$)
  and strpos(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and you can change plan at any time.$lw$, $lw$and you can change plan at any time. To move to a plan with fewer profiles or offline devices, first remove the profiles and free the devices it has no room for.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$and you can change plan at any time.$lw$) > 0;

-- =============================================================================
-- 20261030006003_fix_club_delete_with_meetings.sql
-- =============================================================================
-- Fix: deleting a club with an upcoming meeting failed. The cascade deleted the meeting and its
-- cancel trigger tried to note the change against the club being deleted (a foreign key error),
-- because the trigger ran at depth 1, not nested as migration 5600 expected. Found by
-- supabase/tests/security_test.sql ("deleting a club deletes its members and posts").

create or replace function private.note_club_meeting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- What members will be told: the meeting as it is now (moved), or as it was (cancelled).
  m public.club_meetings := case when tg_op = 'DELETE' then old else new end;
begin
  -- Deleted with the club: nobody to tell, and no club to note it against. The cascade's trigger
  -- isn't always nested (pg_trigger_depth() can be 1), so look for the club itself.
  if tg_op = 'DELETE' and (pg_trigger_depth() > 1 or not exists (select 1 from public.book_clubs b where b.id = old.club_id)) then
    return null;
  end if;
  -- Only meetings members are still waiting for.
  if old.starts_at <= now() then
    return null;
  end if;
  insert into public.club_meeting_changes as c
    (meeting_id, club_id, kind, title, note, was_starts_at, starts_at, minutes, time_zone, changed_by)
  values (
    old.id, old.club_id, case when tg_op = 'DELETE' then 'cancelled' else 'moved' end, m.title, m.note,
    old.starts_at, case when tg_op = 'DELETE' then null else m.starts_at end, m.minutes, m.time_zone, (select auth.uid())
  )
  on conflict (meeting_id) do update set
    kind = excluded.kind, title = excluded.title, note = excluded.note,
    -- Not yet sent: members still know the first time. Already sent: they know the last one.
    was_starts_at = case when c.emailed_at is null then c.was_starts_at else excluded.was_starts_at end,
    starts_at = excluded.starts_at, minutes = excluded.minutes, time_zone = excluded.time_zone,
    changed_by = excluded.changed_by, changed_at = now(), emailed_at = null;
  -- Moved back to the time members were told: nothing to send.
  delete from public.club_meeting_changes c
  where c.meeting_id = old.id and c.kind = 'moved' and c.starts_at = c.was_starts_at and c.emailed_at is null;
  return null;
end;
$$;

-- =============================================================================
-- 20261030006100_profiles_set_aside.sql
-- =============================================================================
-- Profiles set aside, and a plan's room as it will be at renewal.
--
-- reader_profiles.set_aside_at: a profile set aside keeps its shelf, history and settings but
-- doesn't count towards the plan and can't be chosen in Who's reading? until it's brought back.
-- A grown-up sets one aside or brings it back through the manage-profile function (with the
-- account password); the browser can read the column but never write it.
--
-- private.profile_room(): how many profiles the account may use. The plan's, or the smaller of
-- the plan's and the one a yearly membership moves to at renewal (subscriptions.switch_to_monthly),
-- so a household can't grow past the smaller plan before the year ends. Offline device places
-- (claim_offline_device()) follow the same rule.
--
-- When an active membership's room changes (a smaller plan reaches the account, say), the newest
-- profiles over it are set aside; when there's room again (moving up a plan), the ones set aside
-- earliest come back. The oldest profile is always kept.

alter table public.reader_profiles add column set_aside_at timestamptz;
grant select (set_aside_at) on public.reader_profiles to authenticated;

create or replace function private.profile_room(p_account uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select least(p.max_profiles, coalesce(sp.max_profiles, p.max_profiles), 12)::smallint
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    left join public.plans sp on sp.id = s.switch_to_monthly
    where s.user_id = p_account and s.status in ('active', 'past_due')
  ), 1::smallint);
$$;
revoke execute on function private.profile_room(uuid) from public, anon, authenticated;

-- Adding a profile, or bringing one back, needs room among the profiles in use; no household keeps
-- more than 12 profiles in all (Premium's), set aside or not.
create or replace function private.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed smallint;
  in_use  integer;
  total   integer;
begin
  if tg_op = 'UPDATE' and not (old.set_aside_at is not null and new.set_aside_at is null) then
    return new;
  end if;
  -- Serialize concurrent changes for one account so two requests can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtext('reader_profiles:' || new.account_id::text));

  allowed := private.profile_room(new.account_id);
  select count(*) filter (where set_aside_at is null and id <> new.id), count(*) filter (where id <> new.id)
    into in_use, total
  from public.reader_profiles where account_id = new.account_id;

  if new.set_aside_at is null and in_use >= allowed then
    raise exception 'This plan allows % profile(s)', allowed
      using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and total >= 12 then
    raise exception 'A household keeps at most 12 profiles'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reader_profiles_enforce_limit_on_return
  before update of set_aside_at on public.reader_profiles
  for each row execute function private.enforce_profile_limit();

-- Sets aside the newest profiles over the account's room, or brings back the ones set aside
-- earliest while there's room. Only for an active membership: a paused or ended one changes nothing.
create or replace function private.fit_profiles_to_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed smallint;
  in_use  integer;
begin
  if new.status not in ('active', 'past_due') then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('reader_profiles:' || new.user_id::text));
  allowed := private.profile_room(new.user_id);
  select count(*) into in_use from public.reader_profiles where account_id = new.user_id and set_aside_at is null;

  if in_use > allowed then
    update public.reader_profiles r set set_aside_at = now()
    where r.id in (
      select id from public.reader_profiles
      where account_id = new.user_id and set_aside_at is null
        -- Never the oldest: the account keeps at least one profile in use.
        and id <> (select id from public.reader_profiles where account_id = new.user_id order by created_at, id limit 1)
      order by created_at desc, id desc
      limit in_use - allowed
    );
  elsif in_use < allowed then
    update public.reader_profiles r set set_aside_at = null
    where r.id in (
      select id from public.reader_profiles
      where account_id = new.user_id and set_aside_at is not null
      order by set_aside_at, created_at
      limit allowed - in_use
    );
  end if;
  return null;
end;
$$;
revoke execute on function private.fit_profiles_to_plan() from public, anon, authenticated;

-- The webhook writes the whole row on every Stripe event: only a real change counts, or a profile
-- set aside by hand would come straight back.
create trigger subscriptions_fit_profiles_on_insert
  after insert on public.subscriptions
  for each row
  execute function private.fit_profiles_to_plan();

create trigger subscriptions_fit_profiles
  after update of plan_id, status, switch_to_monthly on public.subscriptions
  for each row
  when (old.plan_id is distinct from new.plan_id or old.status is distinct from new.status or old.switch_to_monthly is distinct from new.switch_to_monthly)
  execute function private.fit_profiles_to_plan();

-- Offline device places: the smaller of the plan's and, for a yearly membership moving to monthly
-- at renewal, the next plan's. Otherwise as in migration 4100.
create or replace function public.claim_offline_device(p_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_limit smallint;
  v_plan  text;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null or p_label is null or char_length(btrim(p_label)) not between 1 and 60 then
    raise exception 'a device id and a label of 1 to 60 characters are needed' using errcode = 'check_violation';
  end if;
  -- One claim at a time per account, so two devices can't both take the last place.
  perform pg_advisory_xact_lock(hashtextextended('offline_devices:' || v_user::text, 0));

  update public.offline_devices set last_seen_at = now(), label = btrim(p_label)
  where id = p_id and user_id = v_user;
  if found then
    return jsonb_build_object('status', 'ok');
  end if;
  if exists (select 1 from public.offline_devices where id = p_id) then
    raise exception 'that device id is taken' using errcode = 'unique_violation';
  end if;

  -- Without a membership row, the smallest plan's places.
  select case when sp.download_devices < p.download_devices then sp.download_devices else p.download_devices end,
         case when sp.download_devices < p.download_devices then sp.id else p.id end
    into v_limit, v_plan
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  left join public.plans sp on sp.id = s.switch_to_monthly
  where s.user_id = v_user;
  if v_limit is null then
    select p.download_devices, p.id into v_limit, v_plan from public.plans p where p.id = 'basic';
  end if;

  if (select count(*) from public.offline_devices where user_id = v_user) >= v_limit then
    return jsonb_build_object(
      'status', 'full',
      'plan_id', v_plan,
      'limit', v_limit,
      'devices', coalesce((
        select jsonb_agg(jsonb_build_object('id', d.id, 'label', d.label, 'last_seen_at', d.last_seen_at) order by d.last_seen_at desc)
        from public.offline_devices d where d.user_id = v_user
      ), '[]'::jsonb)
    );
  end if;

  insert into public.offline_devices (id, user_id, label) values (p_id, v_user, btrim(p_label));
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke execute on function public.claim_offline_device(uuid, text) from public, anon;
grant execute on function public.claim_offline_device(uuid, text) to authenticated;

-- =============================================================================
-- 20261030006101_gift_by_email.sql
-- =============================================================================
-- Send a gift by email: the buyer gives the recipient's address (and a short message, if they
-- like) at checkout, and the gift-reminders function emails them the code once it can be redeemed.
--
-- gift_codes.recipient_email and .message come from the Checkout Session's metadata (the checkout
-- function checked them); stripe-webhook writes them with the code. claim_gift_deliveries() picks
-- each due gift once (delivered_at): straight away for a gift that starts now, at 08:00 UTC on
-- the start day for a later one (early morning in the Americas, morning in Europe), and never one
-- already redeemed. Once the email has gone, the function clears the address and the message, so
-- they're kept only until then; a failed send is handed back for the next run.
--
-- The buyer isn't sent the three-day reminder for a gift we deliver, and reminders still go out
-- in the afternoon (UTC): the job now runs hourly so deliveries aren't held back to one run a day.

alter table public.gift_codes
  add column recipient_email text check (
    recipient_email is null
    or (char_length(recipient_email) between 3 and 254 and recipient_email = lower(btrim(recipient_email)) and recipient_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  add column message text check (message is null or (char_length(message) between 1 and 300 and message = btrim(message))),
  add column delivered_at timestamptz;

grant select (recipient_email, message, delivered_at) on public.gift_codes to authenticated;

create or replace function public.claim_gift_deliveries(max_count integer default 200)
returns table (gift_id uuid, code text, plan_id text, months smallint, starts_on date, recipient_email text, message text, buyer_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select g.id
    from public.gift_codes g
    where g.recipient_email is not null
      and g.delivered_at is null
      and g.redeemed_at is null
      and (g.starts_on is null or now() >= (g.starts_on::timestamp + interval '8 hours') at time zone 'utc')
    order by g.created_at
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update skip locked
  ), claimed as (
    update public.gift_codes g set delivered_at = now()
    from due where g.id = due.id
    returning g.id, g.code, g.plan_id, g.months, g.starts_on, g.recipient_email, g.message, g.buyer_id
  )
  select c.id, c.code, c.plan_id, c.months, c.starts_on, c.recipient_email, c.message, p.display_name
  from claimed c
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;
revoke execute on function public.claim_gift_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_deliveries(integer) to service_role;

-- As in migration 6000, but not for a gift we email to its recipient, and from 15:00 UTC.
create or replace function public.claim_gift_start_reminders(max_count integer default 200)
returns table (gift_id uuid, plan_id text, months smallint, starts_on date, email text, buyer_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (now() at time zone 'utc')::time < time '15:00' then
    return;
  end if;
  return query
  with due as (
    select g.id
    from public.gift_codes g
    where g.reminded_at is null
      and g.redeemed_at is null
      and g.recipient_email is null
      and g.delivered_at is null
      and g.buyer_id is not null
      and g.starts_on is not null
      and g.starts_on between (now() at time zone 'utc')::date and (now() at time zone 'utc')::date + 3
      and g.starts_on >= (g.created_at at time zone 'utc')::date + 4
    order by g.starts_on
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update skip locked
  ), claimed as (
    update public.gift_codes g set reminded_at = now()
    from due where g.id = due.id
    returning g.id, g.plan_id, g.months, g.starts_on, g.buyer_id
  )
  select c.id, c.plan_id, c.months, c.starts_on, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.buyer_id and u.email is not null and u.email_confirmed_at is not null
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;
revoke execute on function public.claim_gift_start_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_start_reminders(integer) to service_role;

-- Hourly, five past (it was daily at 15:00).
select cron.unschedule('gift-start-reminders') where exists (select 1 from cron.job where jobname = 'gift-start-reminders');
select cron.schedule('gift-emails', '5 * * * *', $$select private.call_gift_reminders()$$);

-- =============================================================================
-- 20261030006102_club_calendar_feeds.sql
-- =============================================================================
-- Calendar feeds for book clubs: each member gets a subscribe link for a club's meetings, which
-- calendar apps read from the club-calendar function every so often.
--
-- A link carries the club, the member and an HMAC-SHA256 of both, signed with the key below (kept
-- in Vault, read only by the service role), so nothing new is stored and a link can't be made up
-- or changed to another club. The function checks membership on every read: someone who leaves
-- the club stops getting its meetings.

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'club_calendar_secret', 'Signs book club calendar feed links; checked by the club-calendar function')
where not exists (select 1 from vault.secrets where name = 'club_calendar_secret');

create or replace function public.club_calendar_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'club_calendar_secret';
$$;
revoke execute on function public.club_calendar_secret() from public, anon, authenticated;
grant execute on function public.club_calendar_secret() to service_role;

-- =============================================================================
-- 20261030006103_most_followed.sql
-- =============================================================================
-- The most-followed authors (or narrators), for a row on members' Home.
--
-- Like follower_count() and follower_counts(): names and numbers, never who. Only people with at
-- least two followers, so the row shows what readers share rather than one household's taste. At
-- most 12, most followed first (then by name). The follows (kind, name) index (migration 5401)
-- covers it.

create or replace function public.most_followed(p_kind text, p_limit integer default 8)
returns table (name text, followers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name, count(*)::integer as followers
  from public.follows f
  where f.kind = p_kind
  group by f.name
  having count(*) >= 2
  order by count(*) desc, f.name
  limit least(greatest(coalesce(p_limit, 8), 1), 12);
$$;

revoke execute on function public.most_followed(text, integer) from public;
grant execute on function public.most_followed(text, integer) to anon, authenticated;

-- =============================================================================
-- 20261030006104_whats_new_set_aside_gift_email_calendar.sql
-- =============================================================================
-- What's new: this round's changes (src/data/changelog.json has the same).
-- Data only; each skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Set a profile aside$lw$, $lw$Moving to a smaller plan? Instead of deleting a profile, set it aside in Who's reading?: it keeps its shelf, history and settings and doesn't count towards the plan. Bring it back when there's room, or it comes back by itself when you move up a plan.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Set a profile aside$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Email a gift to someone$lw$, $lw$When you buy a gift membership you can now have us email the code to the person it's for, with a short message from you. A gift that starts now arrives within the hour; one for a later day arrives that morning. We forget their address once it's sent.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Email a gift to someone$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Club meetings in your calendar app$lw$, $lw$Each book club now has a calendar link for its members. Add it to Google Calendar, Apple Calendar or Outlook once, and new, moved and cancelled meetings update by themselves.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Club meetings in your calendar app$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Most-followed authors on Home$lw$, $lw$Home now shows the authors readers on LiteraryWorm follow most, with how many follow each. Follow one straight from the row.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Most-followed authors on Home$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$Plan limits when moving to monthly at renewal$lw$, $lw$A yearly membership set to move to a smaller monthly plan at renewal now has that plan's room for profiles and offline devices straight away, so nothing needs removing on renewal day.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Plan limits when moving to monthly at renewal$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030006105_legal_set_aside_gift_email_calendar.sql
-- =============================================================================
-- This round's policy wording (src/data/legalPages.json has the same change): the Privacy Policy
-- covers emailed gifts (what Stripe and Mailgun receive, and that the address and message are kept
-- only until the email goes), profiles set aside and club calendar links; the Terms say profiles
-- can be set aside to fit a smaller plan; the Return Policy says how emailed gifts arrive. A page an
-- editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), and confirming$lw$, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), a gift membership a member asked us to email to you (its code, plan and months, the buyer's display name and any message they wrote), and confirming$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), and confirming$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(and, for a gift that starts on a later day, when we reminded the buyer); only the buyer can see the code$lw$, $lw$(and, for a gift that starts on a later day, when we reminded the buyer). If you ask us to email a gift to someone, Stripe receives their email address and your message with the payment, and we keep both only until the email has gone; only the buyer can see the code$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$(and, for a gift that starts on a later day, when we reminded the buyer); only the buyer can see the code$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal and player settings.$lw$, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal and player settings, and whether it's set aside.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal and player settings.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$such as reading logs, book clubs and shared lists.$lw$, $lw$such as reading logs, book clubs and shared lists. A book club's calendar link lets your calendar app read the club's meetings (their names, times and notes) from us; the link is yours, we don't store it, and it stops working if you leave the club.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$such as reading logs, book clubs and shared lists.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$first remove the profiles and free the devices it has no room for.$lw$, $lw$first set aside or remove the profiles and free the devices it has no room for. A profile set aside keeps its shelf, history and settings, doesn't count towards the plan, and comes back when there's room. While a yearly membership waits to move to a smaller plan at renewal, it has that plan's room already.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$first remove the profiles and free the devices it has no room for.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; we email the buyer three days before)$lw$, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; if the buyer asked us to email it to the person it's for, we send it once it can be redeemed, and otherwise we remind the buyer three days before a later start)$lw$)::jsonb
where slug in ($lw$returns$lw$)
  and strpos(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; we email the buyer three days before)$lw$) > 0;

-- =============================================================================
-- 20261030006200_club_post_emails.sql
-- =============================================================================
-- Book club post emails: a daily email of new posts in the member's clubs, for members who turn
-- it on (off by default: the bell and live alerts already tell them in the app).
--
-- * account_private.club_post_emails: off until the member turns it on in Account → Preferences;
--   off again there or with the email's one-click unsubscribe ("club-posts"). Turning it on starts
--   from that moment, so the first email isn't a backlog.
-- * account_private.club_posts_emailed_through: the time the last email covered up to (service
--   role only; no grant to the browser).
-- * Only posts other members wrote since the member last opened the club (club_members.last_read_at)
--   and since the last email, in clubs with alerts on (club_members.notify), about chapters the
--   account has reached (reading_progress, every chapter once finished): never a spoiler, and no
--   count of what's hidden. The email gives the club, the chapter, how many posts and who wrote
--   them; what they wrote stays in the app. At most a week back.
-- * claim_club_post_digests() moves each due account's emailed_through on and returns its posts
--   by club and chapter, with the time it had before so a failed send can be handed back. For the
--   service role only. pg_cron calls the club-digest function daily with a secret kept in Vault.

alter table public.account_private
  add column club_post_emails boolean not null default false,
  add column club_posts_emailed_through timestamptz;
grant select (club_post_emails), update (club_post_emails) on public.account_private to authenticated;

create or replace function private.club_post_emails_from_now()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.club_post_emails and not old.club_post_emails then
    new.club_posts_emailed_through := now();
  end if;
  return new;
end;
$$;
revoke execute on function private.club_post_emails_from_now() from public, anon, authenticated;

create trigger account_private_club_post_emails
  before update of club_post_emails on public.account_private
  for each row execute function private.club_post_emails_from_now();

-- Claims up to max_count accounts with new posts to hear about and returns one row per club and
-- chapter. Posts from the last minute wait for the next run (a post's time is when its
-- transaction began, so one still committing could otherwise be skipped).
create or replace function public.claim_club_post_digests(max_count integer default 200)
returns table (
  user_id uuid, email text, member_name text,
  club_id uuid, club_name text, volume_id text,
  chapter_index smallint, posts bigint, authors text[],
  was_through timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_until timestamptz := now() - interval '1 minute';
begin
  return query
  with fresh as (
    select m.user_id as reader, p.club_id as club, p.chapter_index as chapter, p.user_id as author
    from public.club_members m
    join public.account_private a on a.user_id = m.user_id and a.club_post_emails
    join public.book_clubs b on b.id = m.club_id
    join public.club_posts p on p.club_id = m.club_id
    left join public.reading_progress r on r.user_id = m.user_id and r.volume_id = b.volume_id
    where m.notify
      and p.user_id <> m.user_id
      and p.created_at > greatest(m.last_read_at, coalesce(a.club_posts_emailed_through, '-infinity'::timestamptz), now() - interval '7 days')
      and p.created_at <= v_until
      and (coalesce(r.finished, false) or p.chapter_index <= coalesce(r.chapter_index, 0))
  ), due as (
    select a.user_id as reader, a.club_posts_emailed_through as was
    from public.account_private a
    join auth.users u on u.id = a.user_id and u.email is not null and u.email_confirmed_at is not null
    where a.user_id in (select f.reader from fresh f)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update of a skip locked
  ), claimed as (
    update public.account_private a set club_posts_emailed_through = v_until
    from due where a.user_id = due.reader
    returning a.user_id as reader, due.was
  )
  select c.reader, u.email::text, me.display_name,
         f.club, b.name, b.volume_id,
         f.chapter, count(*), array_agg(distinct coalesce(w.display_name, 'A member') order by coalesce(w.display_name, 'A member')),
         c.was
  from claimed c
  join fresh f on f.reader = c.reader
  join auth.users u on u.id = c.reader
  join public.book_clubs b on b.id = f.club
  left join public.profiles me on me.id = c.reader
  left join public.profiles w on w.id = f.author
  group by c.reader, u.email, me.display_name, f.club, b.name, b.volume_id, f.chapter, c.was
  order by c.reader, b.name, f.chapter;
end;
$$;
revoke execute on function public.claim_club_post_digests(integer) from public, anon, authenticated;
grant execute on function public.claim_club_post_digests(integer) to service_role;

-- The secret the cron job sends and the club-digest function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'club_digest_secret', 'Sent by the club-digest cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'club_digest_secret');

create or replace function public.club_digest_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'club_digest_secret';
$$;
revoke execute on function public.club_digest_secret() from public, anon, authenticated;
grant execute on function public.club_digest_secret() to service_role;

create or replace function private.call_club_digest()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'club_digest_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/club-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_club_digest() from public, anon, authenticated;

-- Daily at 17:00 UTC (early evening in Europe, lunchtime in the Americas).
select cron.schedule('club-post-digest', '0 17 * * *', $$select private.call_club_digest()$$);

-- =============================================================================
-- 20261030006201_legal_club_posts_devices.sql
-- =============================================================================
-- This round's policy wording (src/data/legalPages.json has the same change): the Privacy Policy
-- lists the daily book club posts email among what Mailgun receives and says devices are one per
-- browser; the Cookie Policy describes literaryworm-device in local storage. A page an editor has
-- reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$with the meeting as a calendar file), a reminder three days before$lw$, $lw$with the meeting as a calendar file), a daily email of new posts in your book clubs if you turn it on (each club's name and book, the chapters you've reached that have new posts, how many and the display names of who wrote them; never what they wrote), a reminder three days before$lw$)::json
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$with the meeting as a calendar file), a reminder three days before$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Devices: while you're signed in, a short label for each open copy of the app (such as \"Chrome on Windows\") so you can send a book to another device.$lw$, $lw$Devices: while you're signed in, a short label for each browser you use the app in (such as \"Chrome on Windows\") so you can send a book to another device.$lw$)::json
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$Devices: while you're signed in, a short label for each open copy of the app (such as \"Chrome on Windows\") so you can send a book to another device.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out.$lw$, $lw$so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out. Next to it the app keeps which of your devices this browser is (under literaryworm-device: a random id and your account's id, nothing else), so a refresh or a second tab isn't listed as a new device in Listen on another device; it's removed when you log out too.$lw$)::json
where slug in ($lw$cookies$lw$)
  and strpos(sections::text, $lw$so you stay signed in after a refresh. It's strictly necessary for your account to work, and it's removed when you log out.$lw$) > 0;

-- =============================================================================
-- 20261030006202_whats_new_club_posts_devices.sql
-- =============================================================================
-- What's new: this round's changes (src/data/changelog.json has the same).
-- Data only; each skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Book club posts by email$lw$, $lw$Turn on Email me new book club posts in Account → Preferences and we'll send one email a day when there's something new in your clubs: which chapters, how many posts and who wrote them. Only chapters you've reached, so no spoilers; the posts themselves stay in the app.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Book club posts by email$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$One device per browser$lw$, $lw$Listen on another device no longer lists the same browser twice after a refresh or in a second tab. Each browser you're signed in on is one device, and it's forgotten when you sign out.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$One device per browser$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030006203_whats_new_more_classics.sql
-- =============================================================================
-- What's new: 50 more public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$50 more classics to read and hear$lw$, $lw$Emma, Great Expectations, Wuthering Heights, Huckleberry Finn, The Hound of the Baskervilles, Heidi, The War of the Worlds and 43 more classics are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to, chapter by chapter. That's 71 in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$50 more classics to read and hear$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030006300_book_texts_bucket.sql
-- =============================================================================
-- The public-domain books' full texts (one JSON file per catalog title, built by
-- front_end/literaryworm_app/scripts/build-texts.py) move out of the site's deploy into a public
-- Storage bucket. The site keeps asking for /texts/<id>.json: Vercel forwards that path here
-- (vercel.json), so the reader, Read offline and the ask and characters functions don't change.
--
-- Public: anyone can read a file by its address, as they could on the site. Nobody writes from
-- the browser (no policies on storage.objects for this bucket); the texts are uploaded with the
-- service role by scripts/upload-texts.sh.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-texts', 'book-texts', true, 8388608, array['application/json'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =============================================================================
-- 20261030006301_whats_new_250_classics.sql
-- =============================================================================
-- What's new: 250 more public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$250 more classics: 321 to read and hear$lw$, $lw$Middlemarch, David Copperfield, The Three Musketeers, Crime and Punishment, Anne of Avonlea, Tarzan of the Apes, ten more Oz books, Wodehouse, Woolf and 240 others are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to. That's 321 classics in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$250 more classics: 321 to read and hear$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261030006302_whats_new_571_classics.sql
-- =============================================================================
-- What's new: a third 250 public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$250 more classics: 571 to read and hear$lw$, $lw$Trollope's Palliser and Barsetshire novels, more Scott, Hardy, Collins and Dumas, The Maltese Falcon, The Sun Also Rises, Kim, The Woman in White, Tom Swift, the Bobbsey Twins, more Tarzan, Wodehouse and 230 others are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to. That's 571 classics in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$250 more classics: 571 to read and hear$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261031006400_new_plan_prices.sql
-- =============================================================================
-- New prices for Standard ($14.99 a month, $149.90 a year) and Premium ($24.99, $249.90); Basic is
-- unchanged. src/data/plans.ts and the checkout function's labels say the same. In Stripe each plan's
-- new price took over its lookup key (literaryworm_<plan>_monthly / _yearly) and the old prices were
-- archived: memberships already running keep the price they started on, new ones (and gifts, which
-- read the Stripe price) pay the new one.

update public.plans set price_cents = 1499, yearly_price_cents = 14990 where id = 'standard';
update public.plans set price_cents = 2499, yearly_price_cents = 24990 where id = 'premium';

-- =============================================================================
-- 20261031006401_whats_new_new_prices.sql
-- =============================================================================
-- What's new: the new Standard and Premium prices (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$New prices for Standard and Premium$lw$, $lw$Standard is now $14.99 a month ($149.90 a year) and Premium $24.99 a month ($249.90 a year), for new memberships and gifts. Basic stays at $7.99. If you're already a member, your price stays as it is.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$New prices for Standard and Premium$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261031006402_basic_price.sql
-- =============================================================================
-- Basic goes to $9.99 a month ($99.90 a year). src/data/plans.ts and the checkout function's labels
-- say the same; in Stripe the new prices took over literaryworm_basic_monthly / _yearly and the old
-- ones were archived (no active subscription was on them).

update public.plans set price_cents = 999, yearly_price_cents = 9990 where id = 'basic';

-- =============================================================================
-- 20261031006403_whats_new_basic_price.sql
-- =============================================================================
-- What's new: the new Basic price (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$New price for Basic$lw$, $lw$Basic is now $9.99 a month ($99.90 a year), for new memberships and gifts. If you're already a member, your price stays as it is.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$New price for Basic$lw$ and c.version = $lw$2026.10$lw$);

-- =============================================================================
-- 20261031006404_whats_new_871_classics.sql
-- =============================================================================
-- What's new: 300 more public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$300 more classics: 871 to read and hear$lw$, $lw$Ulysses, The Divine Comedy, Paradise Lost, Beowulf, Leaves of Grass, Pinocchio, The Blue Fairy Book, Rob Roy, Grant's memoirs, Two Years Before the Mast, The King in Yellow, Arsène Lupin, Dr Thorndyke, Henty's and Altsheler's adventures and 280 others are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to. That's 871 classics in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$300 more classics: 871 to read and hear$lw$ and c.version = $lw$2026.10$lw$);
