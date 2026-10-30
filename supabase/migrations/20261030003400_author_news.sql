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
