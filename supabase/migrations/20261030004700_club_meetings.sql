-- Book club calendar (follow-up): a club's owner schedules meetings; every member sees them on
-- the club page with Add to calendar (a calendar file made in the browser), and gets an email
-- reminder in the day before.
--
-- * club_meetings: one meeting each. Members read their clubs' meetings; only the club's owner
--   adds, changes or deletes them (RLS). A meeting keeps the time zone it was scheduled in, so
--   the reminder gives the time as the owner meant it. Up to 20 upcoming a club; a start must
--   be ahead and within a year (trigger). Changing the time sends a fresh reminder.
-- * account_private.club_meeting_emails: on by default (members joined the club), off in
--   Account → Preferences or with the email's one-click unsubscribe ("club-meetings").
-- * claim_club_meeting_reminders() marks meetings starting in the next 24 hours (and more than
--   an hour away) as reminded and returns them with each member to email; release puts one back.
--   Both for the service role only. pg_cron calls the club-meetings function hourly with a
--   secret kept in Vault, like release-emails.

create table public.club_meetings (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.book_clubs (id) on delete cascade,
  starts_at   timestamptz not null,
  minutes     smallint not null default 60 check (minutes in (30, 45, 60, 90, 120)),
  title       text not null check (char_length(title) between 1 and 80 and title = btrim(title)),
  note        text check (note is null or (char_length(note) between 1 and 500 and note = btrim(note))),
  -- IANA name from the owner's browser, such as Europe/London.
  time_zone   text not null default 'UTC' check (time_zone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' and char_length(time_zone) <= 64),
  created_by  uuid references auth.users (id) on delete set null,
  reminded_at timestamptz,
  created_at  timestamptz not null default now()
);
-- Indexes for club_id (with starts_at) and created_by (foreign keys) are in the 4701 and 4702 migrations.

create or replace function private.check_club_meeting()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at then
    if new.starts_at <= now() then
      raise exception 'Choose a time that''s still to come' using errcode = 'check_violation';
    end if;
    if new.starts_at > now() + interval '366 days' then
      raise exception 'Meetings can be set up to a year ahead' using errcode = 'check_violation';
    end if;
    -- A new time gets a new reminder.
    new.reminded_at := null;
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from public.club_meetings m where m.club_id = new.club_id and m.starts_at > now()
  ) >= 20 then
    raise exception 'A club can have up to 20 upcoming meetings' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_club_meeting() from public, anon, authenticated;

create trigger club_meetings_check
  before insert or update on public.club_meetings
  for each row execute function private.check_club_meeting();

alter table public.club_meetings enable row level security;

create policy "Members see their clubs' meetings" on public.club_meetings for select to authenticated
  using ((select public.is_club_member(club_id)));
create policy "Owners schedule their clubs' meetings" on public.club_meetings for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid()))
  );
create policy "Owners change their clubs' meetings" on public.club_meetings for update to authenticated
  using (exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid())));
create policy "Owners cancel their clubs' meetings" on public.club_meetings for delete to authenticated
  using (exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid())));
create policy "Two-step sign-in when turned on" on public.club_meetings as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.club_meetings from anon, authenticated;
grant select (id, club_id, starts_at, minutes, title, note, time_zone, created_at) on public.club_meetings to authenticated;
grant insert (id, club_id, starts_at, minutes, title, note, time_zone, created_by) on public.club_meetings to authenticated;
grant update (starts_at, minutes, title, note, time_zone) on public.club_meetings to authenticated;
grant delete on public.club_meetings to authenticated;

-- Reminders: on by default, off in Preferences or from the email.
alter table public.account_private add column club_meeting_emails boolean not null default true;
grant select (club_meeting_emails), update (club_meeting_emails) on public.account_private to authenticated;

-- Marks up to max_count meetings starting in the next 24 hours (and more than an hour away) as
-- reminded, and returns one row per member who wants the email, with the club and the address.
create or replace function public.claim_club_meeting_reminders(max_count integer default 100)
returns table (
  meeting_id uuid, club_id uuid, club_name text, volume_id text, title text, note text,
  starts_at timestamptz, minutes smallint, time_zone text,
  user_id uuid, email text, member_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select m.id
    from public.club_meetings m
    where m.reminded_at is null
      and m.starts_at > now() + interval '1 hour'
      and m.starts_at <= now() + interval '24 hours'
    order by m.starts_at
    limit least(greatest(coalesce(max_count, 100), 1), 500)
    for update skip locked
  ), claimed as (
    update public.club_meetings m set reminded_at = now()
    from due where m.id = due.id
    returning m.id, m.club_id, m.title, m.note, m.starts_at, m.minutes, m.time_zone
  )
  select c.id, c.club_id, b.name, b.volume_id, c.title, c.note, c.starts_at, c.minutes, c.time_zone,
         cm.user_id, u.email::text, p.display_name
  from claimed c
  join public.book_clubs b on b.id = c.club_id
  join public.club_members cm on cm.club_id = c.club_id
  join auth.users u on u.id = cm.user_id and u.email is not null and u.email_confirmed_at is not null
  join public.account_private a on a.user_id = cm.user_id and a.club_meeting_emails
  left join public.profiles p on p.id = cm.user_id;
end;
$$;
revoke execute on function public.claim_club_meeting_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_club_meeting_reminders(integer) to service_role;

-- The secret the cron job sends and the club-meetings function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'club_meetings_secret', 'Sent by the club-meetings cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'club_meetings_secret');

create or replace function public.club_meetings_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'club_meetings_secret';
$$;
revoke execute on function public.club_meetings_secret() from public, anon, authenticated;
grant execute on function public.club_meetings_secret() to service_role;

create or replace function private.call_club_meetings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'club_meetings_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/club-meetings',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_club_meetings() from public, anon, authenticated;

-- Hourly, at 20 past: reminders for meetings in the next day.
select cron.schedule('club-meeting-reminders', '20 * * * *', $$select private.call_club_meetings()$$);
