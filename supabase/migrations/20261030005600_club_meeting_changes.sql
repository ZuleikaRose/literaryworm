-- Emails when a book club meeting moves or is cancelled.
--
-- The club's owner could already change a meeting's time (the update policy and grant in the
-- 4700 migration); the app now offers it. When an upcoming meeting's time changes, or an upcoming
-- meeting is cancelled, a trigger notes it in club_meeting_changes, and the club-meetings function
-- (now every 10 minutes) claims the notes with claim_club_meeting_changes() and emails the other
-- members, as it does the reminders: only to confirmed addresses, and only to members who haven't
-- turned club meeting emails off. One note per meeting until it's sent: moving it twice, or moving
-- it then cancelling it, sends one email with the latest. Meetings deleted with their club (the
-- cascade) send nothing.

create table public.club_meeting_changes (
  -- The meeting's id, not a foreign key: a cancelled meeting is gone.
  meeting_id    uuid primary key,
  club_id       uuid not null references public.book_clubs (id) on delete cascade,
  kind          text not null check (kind in ('moved', 'cancelled')),
  title         text not null,
  note          text,
  -- The time members knew, and the new one (null when cancelled).
  was_starts_at timestamptz not null,
  starts_at     timestamptz,
  minutes       smallint not null,
  time_zone     text not null,
  -- The owner who made the change gets no email about it.
  changed_by    uuid references auth.users (id) on delete set null,
  changed_at    timestamptz not null default now(),
  emailed_at    timestamptz,
  check ((kind = 'moved') = (starts_at is not null))
);
-- Indexes for club_id and changed_by (foreign keys) are in the 5601 and 5602 migrations.

-- Only the club-meetings function (service role) reads or writes it.
alter table public.club_meeting_changes enable row level security;
create policy "Two-step sign-in when turned on" on public.club_meeting_changes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
revoke all on public.club_meeting_changes from anon, authenticated;

create or replace function private.note_club_meeting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- What members will be told: the meeting as it is now (moved), or as it was (cancelled).
  m public.club_meetings := case when tg_op = 'DELETE' then old else new end;
begin
  -- Deleted with the club (a cascade, so a nested trigger): nobody to tell.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return null;
  end if;
  -- Only meetings members are still waiting for.
  if old.starts_at <= now() then
    return null;
  end if;
  insert into public.club_meeting_changes as c
    (meeting_id, club_id, kind, title, note, was_starts_at, starts_at, minutes, time_zone, changed_by)
  values (
    old.id, old.club_id, case when tg_op = 'DELETE' then 'cancelled' else 'moved' end, m.title, m.note,
    old.starts_at, case when tg_op = 'DELETE' then null else m.starts_at end, m.minutes, m.time_zone, (select auth.uid())
  )
  on conflict (meeting_id) do update set
    kind = excluded.kind, title = excluded.title, note = excluded.note,
    -- Not yet sent: members still know the first time. Already sent: they know the last one.
    was_starts_at = case when c.emailed_at is null then c.was_starts_at else excluded.was_starts_at end,
    starts_at = excluded.starts_at, minutes = excluded.minutes, time_zone = excluded.time_zone,
    changed_by = excluded.changed_by, changed_at = now(), emailed_at = null;
  -- Moved back to the time members were told: nothing to send.
  delete from public.club_meeting_changes c
  where c.meeting_id = old.id and c.kind = 'moved' and c.starts_at = c.was_starts_at and c.emailed_at is null;
  return null;
end;
$$;
revoke execute on function private.note_club_meeting_change() from public, anon, authenticated;

create trigger club_meetings_note_move
  after update of starts_at on public.club_meetings
  for each row when (old.starts_at is distinct from new.starts_at)
  execute function private.note_club_meeting_change();

create trigger club_meetings_note_cancel
  after delete on public.club_meetings
  for each row execute function private.note_club_meeting_change();

-- Marks up to max_count changes as emailed and returns one row per member to tell (not the
-- owner who made the change), with the club and the address.
create or replace function public.claim_club_meeting_changes(max_count integer default 100)
returns table (
  meeting_id uuid, club_id uuid, club_name text, volume_id text, kind text, title text, note text,
  was_starts_at timestamptz, starts_at timestamptz, minutes smallint, time_zone text,
  user_id uuid, email text, member_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select c.meeting_id
    from public.club_meeting_changes c
    where c.emailed_at is null
    order by c.changed_at
    limit least(greatest(coalesce(max_count, 100), 1), 500)
    for update skip locked
  ), claimed as (
    update public.club_meeting_changes c set emailed_at = now()
    from due where c.meeting_id = due.meeting_id
    returning c.*
  )
  select c.meeting_id, c.club_id, b.name, b.volume_id, c.kind, c.title, c.note,
         c.was_starts_at, c.starts_at, c.minutes, c.time_zone,
         cm.user_id, u.email::text, p.display_name
  from claimed c
  join public.book_clubs b on b.id = c.club_id
  join public.club_members cm on cm.club_id = c.club_id and cm.user_id is distinct from c.changed_by
  join auth.users u on u.id = cm.user_id and u.email is not null and u.email_confirmed_at is not null
  join public.account_private a on a.user_id = cm.user_id and a.club_meeting_emails
  left join public.profiles p on p.id = cm.user_id;
end;
$$;
revoke execute on function public.claim_club_meeting_changes(integer) from public, anon, authenticated;
grant execute on function public.claim_club_meeting_changes(integer) to service_role;

-- Sent notes are kept a month, then cleared.
select cron.schedule(
  'club-meeting-changes-cleanup', '40 3 * * *',
  $$delete from public.club_meeting_changes where emailed_at < now() - interval '30 days'$$
);

-- Every 10 minutes (was hourly), so a change reaches members soon after it's made. Reminders are
-- claimed once each, so running more often sends nothing twice.
select cron.schedule('club-meeting-reminders', '*/10 * * * *', $$select private.call_club_meetings()$$);
