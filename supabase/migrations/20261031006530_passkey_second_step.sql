-- A passkey counts as the second step.
--
-- A passkey is something the member has (the device or password manager) unlocked by something they
-- are or know (a face, a fingerprint, the screen lock), and it can't be phished, so logging in with
-- one no longer also asks for the authenticator code. Auth gives a passkey session aal1, with
-- "passkey" in the JWT's amr, so second_step_done() now accepts that too.
--
-- The catch: someone with only the password could add a passkey of their own from a password-only
-- session and then skip the code. So a passkey counts only once trust_passkey() has marked it
-- trusted, which it does only for a session that gave the code (aal2), or on an account without
-- two-step sign-in. Not for a passkey session: the JWT doesn't say which passkey was used, so it
-- could be the untrusted one being marked (Account asks for the code before adding one then). A
-- passkey session is accepted only when every passkey on the account is trusted: one added without
-- the code makes every passkey ask for the code again until it's removed in Account → Sign-in.

create table public.trusted_passkeys (
  credential_id uuid primary key,                -- auth.webauthn_credentials.id
  user_id uuid not null references auth.users (id) on delete cascade,
  trusted_at timestamptz not null default now()
);

alter table public.trusted_passkeys enable row level security;
-- No policies: only trust_passkey() and second_step_done() (security definer) read or write it.
revoke all on table public.trusted_passkeys from public, anon, authenticated;

-- Passkeys already on accounts were all added in Account → Sign-in, which opens only after the code.
insert into public.trusted_passkeys (credential_id, user_id)
select c.id, c.user_id from auth.webauthn_credentials c
on conflict do nothing;

-- True when this session logged in with a passkey and every passkey on the account is trusted.
create or replace function private.passkey_session_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from jsonb_array_elements(coalesce((select auth.jwt()) -> 'amr', '[]'::jsonb)) a
           where a ->> 'method' = 'passkey'
         )
     and exists (select 1 from auth.webauthn_credentials c where c.user_id = (select auth.uid()))
     and not exists (
           select 1 from auth.webauthn_credentials c
           where c.user_id = (select auth.uid())
             and not exists (
               select 1 from public.trusted_passkeys t where t.credential_id = c.id and t.user_id = c.user_id
             )
         );
$$;

revoke execute on function private.passkey_session_ok() from public, anon, authenticated;

-- True unless the caller has a verified factor and the session has used neither it nor a trusted passkey.
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
      )
      or private.passkey_session_ok();
$$;

revoke execute on function public.second_step_done() from public, anon;
grant execute on function public.second_step_done() to authenticated, service_role;

-- Marks a passkey this member has just added as trusted, when this session gave the code (or the
-- account has no two-step sign-in). Only the member's own passkeys added in the last 10 minutes.
-- Returns whether it was marked.
create or replace function public.trust_passkey(p_credential uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  if not (
    coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_user and f.status = 'verified')
  ) then
    raise exception 'Enter the code from your authenticator app first.' using errcode = '42501';
  end if;
  insert into public.trusted_passkeys (credential_id, user_id)
  select c.id, c.user_id from auth.webauthn_credentials c
  where c.id = p_credential and c.user_id = v_user and c.created_at > now() - interval '10 minutes'
  on conflict do nothing;
  return exists (select 1 from public.trusted_passkeys t where t.credential_id = p_credential and t.user_id = v_user);
end;
$$;

revoke execute on function public.trust_passkey(uuid) from public, anon;
grant execute on function public.trust_passkey(uuid) to authenticated;
