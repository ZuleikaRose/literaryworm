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
