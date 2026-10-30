-- Fix: deleting a club with an upcoming meeting failed. The cascade deleted the meeting and its
-- cancel trigger tried to note the change against the club being deleted (a foreign key error),
-- because the trigger ran at depth 1, not nested as migration 5600 expected. Found by
-- supabase/tests/security_test.sql ("deleting a club deletes its members and posts").

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
  -- Deleted with the club: nobody to tell, and no club to note it against. The cascade's trigger
  -- isn't always nested (pg_trigger_depth() can be 1), so look for the club itself.
  if tg_op = 'DELETE' and (pg_trigger_depth() > 1 or not exists (select 1 from public.book_clubs b where b.id = old.club_id)) then
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
