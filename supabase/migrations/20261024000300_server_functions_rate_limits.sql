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
