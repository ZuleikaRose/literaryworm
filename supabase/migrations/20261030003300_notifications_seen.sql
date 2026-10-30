-- The notification bell (story 56).
--
-- The bell counts what's new for a profile: books from its reminders that came
-- out since it last opened the bell, and its account's unread club posts (which
-- keep their own read state, club_members.last_read_at). Opening the bell sets
-- notifications_seen_at through mark_notifications_seen(), at the database's
-- time, so every device signed in to the profile agrees on what's been seen.

alter table public.reader_profiles
  add column notifications_seen_at timestamptz;

grant select (notifications_seen_at) on public.reader_profiles to authenticated;

-- Marks the profile's notifications seen for the caller and returns when. Only
-- the caller's own profiles change (RLS on reader_profiles, including the
-- two-step sign-in policy); a profile that isn't theirs returns null.
create function public.mark_notifications_seen(p_profile_id uuid)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  update public.reader_profiles
     set notifications_seen_at = now()
   where id = p_profile_id and account_id = (select auth.uid())
  returning notifications_seen_at;
$$;

grant update (notifications_seen_at) on public.reader_profiles to authenticated;

revoke execute on function public.mark_notifications_seen(uuid) from public, anon;
grant execute on function public.mark_notifications_seen(uuid) to authenticated;
