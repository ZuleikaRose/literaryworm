-- Year in reading: on 1 January (carrying on to the 3rd) members who turned it on get one email
-- of the year just ended for every profile in the household: time read and listened, days read,
-- books finished (catalog titles named), and the month they read most.
--
-- * account_private.year_emails: off until the member turns it on (opt-in, Account → Preferences).
-- * year_in_reading_sends: which accounts have had which year's email, so each gets it once.
--   Server only.
-- * claim_year_in_reading_emails() marks accounts that asked for it and haven't had that year's;
--   year_in_reading() returns each profile's year. Both for the service role only.
-- * The year-in-reading function (pg_cron, 1st to 3rd January, with a key kept in Vault, like
--   kids-report) sends them. Each email has a one-click unsubscribe link (the unsubscribe
--   function, list "year-in-reading").

alter table public.account_private add column year_emails boolean not null default false;
grant select (year_emails), update (year_emails) on public.account_private to authenticated;

create table public.year_in_reading_sends (
  user_id uuid not null references auth.users (id) on delete cascade,
  year    integer not null check (year between 2020 and 2200),
  sent_at timestamptz not null default now(),
  primary key (user_id, year)
);
-- user_id leads the primary key, so the foreign key is indexed.
alter table public.year_in_reading_sends enable row level security;
revoke all on public.year_in_reading_sends from anon, authenticated;
grant all on public.year_in_reading_sends to service_role;

-- Marks up to max_count accounts that asked for it, read at all that year and haven't had
-- p_year's yet, and returns them with the address; the function hands back any it couldn't send.
create or replace function public.claim_year_in_reading_emails(p_year integer, max_count integer default 500)
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
    where a.year_emails
      and exists (select 1 from public.reading_days d
                   where d.user_id = a.user_id and d.minutes >= 1
                     and d.day between make_date(p_year, 1, 1) and make_date(p_year, 12, 31))
      and not exists (select 1 from public.year_in_reading_sends s where s.user_id = a.user_id and s.year = p_year)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 500), 1), 1000)
  ), claimed as (
    insert into public.year_in_reading_sends (user_id, year)
    select due.user_id, p_year from due
    on conflict do nothing
    returning year_in_reading_sends.user_id
  )
  select c.user_id, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id;
end;
$$;
revoke execute on function public.claim_year_in_reading_emails(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_year_in_reading_emails(integer, integer) to service_role;

-- Each profile's year (profiles in use, set aside ones too), by name.
create or replace function public.year_in_reading(p_user uuid, p_year integer)
returns table (profile_name text, minutes integer, listening_minutes integer, days_read integer, books_finished integer, finished_books text[], best_month integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name::text,
         coalesce(sum(d.minutes), 0)::integer,
         coalesce(sum(d.listening_minutes), 0)::integer,
         count(d.day) filter (where d.minutes >= 1)::integer,
         (select count(*)::integer from public.finished_books f
           where f.profile_id = p.id and f.user_id = p_user
             and f.finished_on between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)),
         coalesce((select array_agg(f.volume_id order by f.finished_on)
                     from public.finished_books f
                    where f.profile_id = p.id and f.user_id = p_user
                      and f.finished_on between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)), '{}'),
         (select extract(month from m.day)::integer
            from public.reading_days m
           where m.profile_id = p.id and m.user_id = p_user
             and m.day between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
           group by extract(month from m.day)
          having sum(m.minutes) > 0
           order by sum(m.minutes) desc, extract(month from m.day)
           limit 1)
  from public.reader_profiles p
  left join public.reading_days d on d.profile_id = p.id and d.user_id = p_user
                                 and d.day between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
  where p.account_id = p_user
  group by p.id, p.name
  order by p.name;
$$;
revoke execute on function public.year_in_reading(uuid, integer) from public, anon, authenticated;
grant execute on function public.year_in_reading(uuid, integer) to service_role;

-- The key the cron job sends and the function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'year_in_reading_secret', 'Sent by the year-in-reading cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'year_in_reading_secret');

create or replace function public.year_in_reading_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'year_in_reading_secret';
$$;
revoke execute on function public.year_in_reading_secret() from public, anon, authenticated;
grant execute on function public.year_in_reading_secret() to service_role;

create or replace function private.call_year_in_reading()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  key  text := (select decrypted_secret from vault.decrypted_secrets where name = 'year_in_reading_secret');
begin
  if base is null or key is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/year-in-reading',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_year_in_reading() from public, anon, authenticated;

-- 10:00 UTC on 1 January: last year's email. A run that's cut short carries on on the 2nd and 3rd
-- (accounts already sent are skipped).
select cron.schedule('year-in-reading-email', '0 10 1-3 1 *', $$select private.call_year_in_reading()$$);
