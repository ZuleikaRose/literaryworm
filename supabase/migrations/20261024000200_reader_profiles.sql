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
