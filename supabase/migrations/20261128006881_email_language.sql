-- The language LiteraryWorm's emails are written in, per account.
--
-- * account_private.email_language: what the member chose in Account → Preferences; null until they
--   choose, so emails follow the household's first grown-up profile's interface language
--   (reader_profiles.ui_language), else English.
-- * account_email_language(user): that rule, for the email functions (service role only). Every
--   claim_* function the email functions use returns it beside the address.
-- Supabase Auth's own emails (confirming an address, resetting the password, changing the address)
-- can't read the database: they use the user's metadata, ui_language, which the app keeps equal to
-- this (set at sign-up and whenever the member chooses).

alter table public.account_private
  add column email_language text
  check (email_language is null or email_language in (
    'en', 'es', 'fr', 'de', 'pt', 'it', 'nl',
    'ja', 'zh', 'ko', 'hi', 'ar', 'pl', 'ru', 'tr', 'sv', 'uk', 'tl', 'bg', 'ro', 'el'
  ));
grant select (email_language), update (email_language) on public.account_private to authenticated;

create or replace function public.account_email_language(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.email_language from public.account_private p where p.user_id = p_user),
    (select r.ui_language from public.reader_profiles r
      where r.account_id = p_user and r.age_rating <> 'kids' and r.ui_language is not null
      order by r.created_at, r.id limit 1),
    'en'
  );
$$;
revoke execute on function public.account_email_language(uuid) from public, anon, authenticated;
grant execute on function public.account_email_language(uuid) to service_role;

-- The log-in alert claim (6877) returns it too.
drop function public.claim_sign_in_alerts(integer);
create function public.claim_sign_in_alerts(max_count integer default 200)
returns table (session_id uuid, email text, display_name text, device text, signed_in_at timestamptz, language text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.sign_in_alerts a
  where a.signed_in_at < now() - interval '1 day'
     or (a.claimed_at is null and a.signed_in_at < now() - interval '2 minutes'
         and not exists (select 1 from auth.sessions s where s.id = a.session_id))
     or (a.claimed_at is null and exists (
           select 1 from public.account_private p where p.user_id = a.user_id and not p.sign_in_emails));

  return query
  with due as (
    select a.session_id
    from public.sign_in_alerts a
    where a.claimed_at is null
      and a.signed_in_at < now() - interval '2 minutes'
    order by a.signed_in_at
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update skip locked
  ), claimed as (
    update public.sign_in_alerts a set claimed_at = now()
    from due where a.session_id = due.session_id
    returning a.session_id, a.user_id, a.device, a.signed_in_at
  )
  select c.session_id, u.email::text, p.display_name, c.device, c.signed_in_at, public.account_email_language(c.user_id)
  from claimed c
  join auth.users u on u.id = c.user_id and u.email is not null and u.email_confirmed_at is not null
  left join public.profiles p on p.id = c.user_id;
end;
$$;
revoke execute on function public.claim_sign_in_alerts(integer) from public, anon, authenticated;
grant execute on function public.claim_sign_in_alerts(integer) to service_role;
