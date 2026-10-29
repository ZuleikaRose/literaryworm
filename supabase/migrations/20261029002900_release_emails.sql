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
