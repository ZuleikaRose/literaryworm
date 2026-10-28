-- Club notifications (Phase 19).
--
-- club_members gains each member's last_read_at (when they last opened the
-- club, set by mark_club_read()) and notify (whether new posts alert them).
-- club_unread() counts the posts other members wrote since then, by chapter, so
-- the app can leave out chapters the reader hasn't reached (no spoilers in a
-- count or an alert). New posts reach open copies of the app through Supabase
-- Realtime; RLS means each member hears only their own clubs' posts.

alter table public.club_members
  add column last_read_at timestamptz not null default now(),
  add column notify       boolean     not null default true;

create policy "Members change their own membership" on public.club_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant update (notify, last_read_at) on public.club_members to authenticated;

-- Marks a club read for the caller, at the database's time.
create function public.mark_club_read(p_club_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.club_members
     set last_read_at = now()
   where club_id = p_club_id and user_id = (select auth.uid());
$$;

-- The caller's unread posts in each of their clubs, by chapter.
create function public.club_unread()
returns table (club_id uuid, chapter_index smallint, posts bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.club_id, p.chapter_index, count(*)
    from public.club_posts p
    join public.club_members m on m.club_id = p.club_id and m.user_id = (select auth.uid())
   where p.created_at > m.last_read_at
     and p.user_id <> (select auth.uid())
   group by p.club_id, p.chapter_index;
$$;

revoke execute on function public.mark_club_read(uuid), public.club_unread() from public, anon;
grant execute on function public.mark_club_read(uuid), public.club_unread() to authenticated;

alter publication supabase_realtime add table public.club_posts;
