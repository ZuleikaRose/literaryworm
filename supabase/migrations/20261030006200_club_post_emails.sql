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
