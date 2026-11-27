-- Recovery codes for two-step sign-in.
--
-- A member with two-step sign-in on can make ten single-use recovery codes in Account → Sign-in and
-- keep them somewhere safe. If they lose the phone with their authenticator app, the log-in page's
-- second step takes a recovery code instead: the `recovery-code` Edge Function checks it with
-- check_recovery_code() (service role only), then removes the account's authenticator factors through
-- Auth's admin API and deletes every code, so two-step sign-in is off and the session (aal1, no
-- verified factor) passes second_step_done(). The member then sets two-step sign-in up again on the
-- new phone and makes new codes. Supabase Auth has no recovery codes of its own, and a session can't
-- be raised to aal2 without a factor, so turning the factor off is the supported way back in.
--
-- Codes are shown once and kept only as SHA-256 hashes of the account id and the code. Each code is
-- 10 characters of Crockford base32 (50 random bits from gen_random_bytes), shown as xxxxx-xxxxx;
-- checking is rate limited per account, so they can't be guessed.
--
-- A code counts only while two-step sign-in is on and only if it was made after the oldest verified
-- factor: codes made before the member turned it off and on again never work for the new set-up
-- (forget_recovery_codes() also deletes them when it's turned off in Account).

create table public.recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  -- Also the index for the foreign key (user_id leads).
  unique (user_id, code_hash)
);

alter table public.recovery_codes enable row level security;
-- No policies: only the functions below (security definer) and the service role read or write it.
revoke all on table public.recovery_codes from public, anon, authenticated;
grant select, insert, delete on table public.recovery_codes to service_role;

-- How a code is written down doesn't matter: case, spaces and dashes are ignored, and the letters
-- Crockford base32 leaves out are read as the digits they look like (o → 0, i and l → 1).
create or replace function private.recovery_code_text(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g')), 'oil', '011');
$$;

create or replace function private.recovery_code_hash(p_user uuid, p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_user::text || ':' || p_code, 'sha256'), 'hex');
$$;

revoke execute on function private.recovery_code_text(text) from public, anon, authenticated;
revoke execute on function private.recovery_code_hash(uuid, text) from public, anon, authenticated;

-- The codes that still work for this account: two-step sign-in is on, and they were made after its
-- oldest verified factor.
create or replace function private.live_recovery_codes(p_user uuid)
returns setof public.recovery_codes
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.recovery_codes r
  where r.user_id = p_user
    and r.created_at >= (
      select min(f.created_at) from auth.mfa_factors f where f.user_id = p_user and f.status = 'verified'
    );
$$;

revoke execute on function private.live_recovery_codes(uuid) from public, anon, authenticated;

-- Makes ten new codes for the caller, replacing any made before, and returns them (the only time
-- they're seen). Needs two-step sign-in on and the second step done in this session.
create or replace function public.create_recovery_codes()
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  alphabet constant text := '0123456789abcdefghjkmnpqrstvwxyz';
  codes text[] := '{}';
  raw bytea;
  code text;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.mfa_factors f where f.user_id = v_user and f.status = 'verified') then
    raise exception 'Turn on two-step sign-in first.' using errcode = 'check_violation';
  end if;
  if not public.check_rate_limit('create_recovery_codes:' || v_user::text, 10, 3600) then
    raise exception 'Too many tries. Wait an hour and try again.' using errcode = 'check_violation';
  end if;
  delete from public.recovery_codes where user_id = v_user;
  while coalesce(array_length(codes, 1), 0) < 10 loop
    raw := extensions.gen_random_bytes(10);
    code := '';
    -- 256 is a multiple of 32, so each character is evenly likely.
    for i in 0..9 loop
      code := code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    end loop;
    if not (code = any (codes)) then
      codes := codes || code;
      insert into public.recovery_codes (user_id, code_hash) values (v_user, private.recovery_code_hash(v_user, code));
    end if;
  end loop;
  return array(select substr(c, 1, 5) || '-' || substr(c, 6, 5) from unnest(codes) c);
end;
$$;

revoke execute on function public.create_recovery_codes() from public, anon;
grant execute on function public.create_recovery_codes() to authenticated;

-- How many of the caller's codes still work (0 when two-step sign-in is off).
create or replace function public.recovery_codes_left()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  return (select count(*)::integer from private.live_recovery_codes(v_user));
end;
$$;

revoke execute on function public.recovery_codes_left() from public, anon;
grant execute on function public.recovery_codes_left() to authenticated;

-- Deletes the caller's codes (after turning two-step sign-in off in Account).
create or replace function public.forget_recovery_codes()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  delete from public.recovery_codes where user_id = v_user;
end;
$$;

revoke execute on function public.forget_recovery_codes() from public, anon;
grant execute on function public.forget_recovery_codes() to authenticated;

-- For the recovery-code function only: 'ok' when the code is one of the account's working codes,
-- 'wrong' when it isn't, 'rate_limited' after 10 tries in an hour (counted before checking, so right
-- and wrong answers count alike). Nothing is used up here: the function deletes every code once the
-- account's factors are gone, so a failure in between leaves the code to try again.
create or replace function public.check_recovery_code(p_user uuid, p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := private.recovery_code_text(p_code);
begin
  if p_user is null then
    raise exception 'No account' using errcode = 'invalid_parameter_value';
  end if;
  if not public.check_rate_limit('recovery_code:' || p_user::text, 10, 3600) then
    return 'rate_limited';
  end if;
  if v_code !~ '^[0-9a-hjkmnp-tv-z]{10}$' then
    return 'wrong';
  end if;
  if exists (
    select 1 from private.live_recovery_codes(p_user) r
    where r.code_hash = private.recovery_code_hash(p_user, v_code)
  ) then
    return 'ok';
  end if;
  return 'wrong';
end;
$$;

revoke execute on function public.check_recovery_code(uuid, text) from public, anon, authenticated;
grant execute on function public.check_recovery_code(uuid, text) to service_role;
