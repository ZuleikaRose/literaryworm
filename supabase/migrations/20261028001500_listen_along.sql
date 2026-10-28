-- Listen along (Phase 20).
--
-- A club member leads a listening session of the club's book; other members
-- join and hear the same place. club_listening holds one session per club: who
-- leads it, where they are and whether they're playing, and the speed. The host
-- updates it as they play, pause and skip (and every half minute, so a
-- session whose host has gone can be told apart); members hear each change
-- through Supabase Realtime and follow.
--
-- A session nobody has updated for two minutes has been left (the host closed
-- the app): any member may take it over by becoming its host. Only the host
-- moves it; the host or the club's owner can end it. Leaving the club, or
-- deleting it, ends the sessions that depended on it.

create table public.club_listening (
  club_id          uuid primary key references public.book_clubs (id) on delete cascade,
  host_id          uuid not null,
  position_seconds double precision not null check (position_seconds >= 0 and position_seconds < 1000000),
  playing          boolean not null default false,
  rate             real not null default 1 check (rate between 0.5 and 3),
  updated_at       timestamptz not null default now(),
  -- The host must be a member: leaving the club ends a session they lead.
  foreign key (club_id, host_id) references public.club_members (club_id, user_id) on delete cascade
);

create trigger club_listening_set_updated_at
  before update on public.club_listening
  for each row execute function public.set_updated_at();

alter table public.club_listening enable row level security;

create policy "Members see their clubs' sessions" on public.club_listening for select to authenticated
  using (public.is_club_member(club_id));
create policy "Members start a session as its host" on public.club_listening for insert to authenticated
  with check (host_id = (select auth.uid()) and public.is_club_member(club_id));
-- The host moves it; any member may take over a session left for two minutes.
create policy "Hosts move their session, members take over a left one" on public.club_listening for update to authenticated
  using (
    host_id = (select auth.uid())
    or (public.is_club_member(club_id) and updated_at < now() - interval '2 minutes')
  )
  with check (host_id = (select auth.uid()) and public.is_club_member(club_id));
create policy "Hosts and club owners end a session" on public.club_listening for delete to authenticated
  using (
    host_id = (select auth.uid())
    or exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid()))
  );

revoke all on public.club_listening from anon, authenticated;
grant select, delete on public.club_listening to authenticated;
grant insert (club_id, host_id, position_seconds, playing, rate) on public.club_listening to authenticated;
grant update (host_id, position_seconds, playing, rate) on public.club_listening to authenticated;

alter publication supabase_realtime add table public.club_listening;
