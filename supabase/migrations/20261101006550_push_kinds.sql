-- More kinds of notification on a device (migration 6535 sent only release day). An account
-- chooses which kinds its devices get (account_private.push_kinds, all on by default; Account →
-- Preferences under Notifications on this device):
--   release     a book a profile set Remind me on is out (claim_release_pushes, now checking this)
--   meeting     a club meeting in the next day (claim_meeting_pushes; club_meeting_pushes, once per
--               member and start time, so a moved meeting is announced again)
--   club_posts  new posts by others in clubs with alerts on, only up to the chapter the account has
--               reached (claim_club_post_pushes; account_private.club_posts_pushed_through)
--   streak      in the evening on the device's clock, a profile that read the three days before
--               hasn't read yet today (claim_streak_pushes; account_private.streak_pushed_on)
--   request     a grown-up answered a Kids profile's book request (sent by manage-profile at once)
-- The release-emails run sends the claimed ones every hour. A device keeps its time zone
-- (push_subscriptions.time_zone, from the browser) for the evening nudge. Index on
-- club_meeting_pushes.user_id in the next migration.

alter table public.account_private
  add column push_kinds text[] not null default array['release', 'meeting', 'club_posts', 'streak', 'request']
    check (push_kinds <@ array['release', 'meeting', 'club_posts', 'streak', 'request']::text[]),
  add column club_posts_pushed_through timestamptz not null default now(),
  add column streak_pushed_on date;
grant select (push_kinds), update (push_kinds) on public.account_private to authenticated;

alter table public.push_subscriptions add column time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 64);

-- The browser now sends its time zone too; an unknown zone is kept as UTC.
drop function public.save_push_subscription(text, text, text, text);
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_label text default '', p_time_zone text default 'UTC')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_zone text := coalesce(nullif(btrim(p_time_zone), ''), 'UTC');
begin
  if v_user is null then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  if not public.second_step_done() then
    raise exception 'Enter the code from your authenticator app first.' using errcode = '42501';
  end if;
  begin
    perform now() at time zone v_zone;
  exception when others then
    v_zone := 'UTC';
  end;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> v_user;
  if not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint)
     and (select count(*) from public.push_subscriptions where user_id = v_user) >= 20 then
    raise exception 'Notifications are on for 20 devices already. Turn them off on one first.' using errcode = 'check_violation';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label, time_zone)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(coalesce(p_label, ''), 120), left(v_zone, 64))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device_label = excluded.device_label, time_zone = excluded.time_zone
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text) to authenticated;

-- Release day, now only for accounts that keep that kind on.
create or replace function public.claim_release_pushes(max_count integer default 200)
returns table (user_id uuid, profile_name text, volume_id text, title text, author text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select r.profile_id, r.user_id, r.volume_id
    from public.release_reminders r
    join public.account_private a on a.user_id = r.user_id and 'release' = any (a.push_kinds)
    where r.pushed_at is null
      and r.release_date <= current_date
      and r.release_date > current_date - 7
      and exists (select 1 from public.push_subscriptions s where s.user_id = r.user_id)
    order by r.user_id, r.release_date
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update of r skip locked
  ), claimed as (
    update public.release_reminders r
    set pushed_at = now()
    from due
    where r.profile_id = due.profile_id and r.user_id = due.user_id and r.volume_id = due.volume_id
    returning r.user_id, r.profile_id, r.volume_id, r.title, r.author
  )
  select c.user_id, rp.name, c.volume_id, c.title, c.author
  from claimed c
  left join public.reader_profiles rp on rp.id = c.profile_id
  order by c.user_id, c.title;
end;
$$;

-- Meeting reminders: one per member and start time.
create table public.club_meeting_pushes (
  meeting_id uuid not null references public.club_meetings (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  starts_at  timestamptz not null,
  sent_at    timestamptz not null default now(),
  primary key (meeting_id, user_id, starts_at)
);
alter table public.club_meeting_pushes enable row level security;
revoke all on public.club_meeting_pushes from anon, authenticated;

create or replace function public.claim_meeting_pushes(max_count integer default 200)
returns table (user_id uuid, club_id uuid, club_name text, title text, starts_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select m.id as meeting, m.club_id as club, m.title as meeting_title, m.starts_at as at, cm.user_id as member
    from public.club_meetings m
    join public.club_members cm on cm.club_id = m.club_id
    join public.account_private a on a.user_id = cm.user_id and 'meeting' = any (a.push_kinds)
    where m.starts_at > now() + interval '1 hour'
      and m.starts_at <= now() + interval '24 hours'
      and exists (select 1 from public.push_subscriptions s where s.user_id = cm.user_id)
      and not exists (select 1 from public.club_meeting_pushes x where x.meeting_id = m.id and x.user_id = cm.user_id and x.starts_at = m.starts_at)
      and not exists (select 1 from public.club_meeting_rsvps r where r.meeting_id = m.id and r.user_id = cm.user_id and r.answer = 'no')
    order by m.starts_at
    limit least(greatest(coalesce(max_count, 200), 1), 500)
  ), claimed as (
    insert into public.club_meeting_pushes (meeting_id, user_id, starts_at)
    select d.meeting, d.member, d.at from due d
    on conflict do nothing
    returning meeting_id, club_meeting_pushes.user_id as member, club_meeting_pushes.starts_at as at
  )
  select d.member, d.club, b.name, d.meeting_title, d.at
  from claimed c
  join due d on d.meeting = c.meeting_id and d.member = c.member and d.at = c.at
  join public.book_clubs b on b.id = d.club
  order by d.member, d.at;
end;
$$;

-- New club posts by others, only about chapters the account has reached (like the daily email).
create or replace function public.claim_club_post_pushes(max_count integer default 200)
returns table (user_id uuid, club_id uuid, club_name text, last_chapter smallint, posts bigint, authors text[])
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
    join public.account_private a on a.user_id = m.user_id and 'club_posts' = any (a.push_kinds)
    join public.book_clubs b on b.id = m.club_id
    join public.club_posts p on p.club_id = m.club_id
    left join public.reading_progress r on r.user_id = m.user_id and r.volume_id = b.volume_id
    where m.notify
      and p.user_id <> m.user_id
      and p.created_at > greatest(m.last_read_at, a.club_posts_pushed_through, now() - interval '1 day')
      and p.created_at <= v_until
      and (coalesce(r.finished, false) or p.chapter_index <= coalesce(r.chapter_index, 0))
      and exists (select 1 from public.push_subscriptions s where s.user_id = m.user_id)
  ), due as (
    select a.user_id as reader
    from public.account_private a
    where a.user_id in (select f.reader from fresh f)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update of a skip locked
  ), claimed as (
    update public.account_private a set club_posts_pushed_through = v_until
    from due where a.user_id = due.reader
    returning a.user_id as reader
  )
  select c.reader, f.club, b.name, max(f.chapter), count(*),
         array_agg(distinct coalesce(w.display_name, 'A member') order by coalesce(w.display_name, 'A member'))
  from claimed c
  join fresh f on f.reader = c.reader
  join public.book_clubs b on b.id = f.club
  left join public.profiles w on w.id = f.author
  group by c.reader, f.club, b.name
  order by c.reader, b.name;
end;
$$;

-- The evening nudge: between 7 and 10 pm on the account's most recent device's clock, once a
-- local day, for the profile with the longest run (three days or more, ending yesterday) that
-- hasn't read yet today.
create or replace function public.claim_streak_pushes(max_count integer default 200)
returns table (user_id uuid, profile_name text, days integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with zones as (
    select distinct on (s.user_id) s.user_id as account, s.time_zone as zone
    from public.push_subscriptions s
    order by s.user_id, s.created_at desc
  ), local as (
    select z.account, (now() at time zone z.zone)::date as today, extract(hour from now() at time zone z.zone) as hour
    from zones z
  ), runs as (
    select l.account, l.today, p.id as profile, p.name,
      (select coalesce(min(g), 61) - 1 from generate_series(1, 61) g
        where not exists (select 1 from public.reading_days d where d.profile_id = p.id and d.user_id = l.account and d.day = l.today - g and d.minutes > 0)) as streak
    from local l
    join public.account_private a on a.user_id = l.account and 'streak' = any (a.push_kinds) and a.streak_pushed_on is distinct from l.today
    join public.reader_profiles p on p.account_id = l.account and p.set_aside_at is null
    where l.hour between 19 and 21
      and not exists (select 1 from public.reading_days d where d.profile_id = p.id and d.user_id = l.account and d.day = l.today and d.minutes > 0)
  ), best as (
    select distinct on (r.account) r.account, r.today, r.name, r.streak
    from runs r
    where r.streak >= 3
    order by r.account, r.streak desc, r.name
    limit least(greatest(coalesce(max_count, 200), 1), 500)
  ), claimed as (
    update public.account_private a set streak_pushed_on = b.today
    from best b
    where a.user_id = b.account and a.streak_pushed_on is distinct from b.today
    returning a.user_id as account
  )
  select b.account, b.name, b.streak
  from claimed c join best b on b.account = c.account;
end;
$$;

revoke execute on function public.claim_meeting_pushes(integer) from public, anon, authenticated;
revoke execute on function public.claim_club_post_pushes(integer) from public, anon, authenticated;
revoke execute on function public.claim_streak_pushes(integer) from public, anon, authenticated;
grant execute on function public.claim_meeting_pushes(integer) to service_role;
grant execute on function public.claim_club_post_pushes(integer) to service_role;
grant execute on function public.claim_streak_pushes(integer) to service_role;
