-- Voting on a club's pace (lib/clubPace.ts, components/ClubSchedule.tsx): each member votes for how
-- many chapters a week the club should read; the owner chooses one (book_clubs.chapters_per_week,
-- the owner's own policy), which clears the votes for a new round. Members read their clubs' votes;
-- votes are written only through vote_club_pace(). A member's vote goes when they leave the club.

create table if not exists public.club_pace_votes (
  club_id           uuid not null references public.book_clubs (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  chapters_per_week smallint not null check (chapters_per_week between 1 and 100),
  voted_at          timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.club_pace_votes enable row level security;

drop policy if exists "Members see their clubs' pace votes" on public.club_pace_votes;
create policy "Members see their clubs' pace votes" on public.club_pace_votes for select to authenticated
  using (public.is_club_member(club_id));
drop policy if exists "Two-step sign-in when turned on" on public.club_pace_votes;
create policy "Two-step sign-in when turned on" on public.club_pace_votes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.club_pace_votes from anon, authenticated;
grant select (club_id, user_id, chapters_per_week, voted_at) on public.club_pace_votes to authenticated;
grant select, insert, update, delete on public.club_pace_votes to service_role;

-- A member's vote (null takes it back).
create or replace function public.vote_club_pace(p_club uuid, p_chapters_per_week smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to vote' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.club_members cm where cm.club_id = p_club and cm.user_id = v_user) then
    raise exception 'Only the club''s members can vote' using errcode = 'insufficient_privilege';
  end if;
  if p_chapters_per_week is null then
    delete from public.club_pace_votes where club_id = p_club and user_id = v_user;
  elsif p_chapters_per_week < 1 or p_chapters_per_week > 100 then
    raise exception 'Choose 1 to 100 chapters a week' using errcode = 'check_violation';
  else
    insert into public.club_pace_votes (club_id, user_id, chapters_per_week)
    values (p_club, v_user, p_chapters_per_week)
    on conflict (club_id, user_id) do update set chapters_per_week = excluded.chapters_per_week, voted_at = now();
  end if;
end;
$$;
revoke execute on function public.vote_club_pace(uuid, smallint) from public, anon;
grant execute on function public.vote_club_pace(uuid, smallint) to authenticated, service_role;

-- The owner choosing a pace starts a new round.
create or replace function private.clear_club_pace_votes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'book_clubs' then
    if new.chapters_per_week is distinct from old.chapters_per_week then
      delete from public.club_pace_votes where club_id = new.id;
    end if;
    return new;
  end if;
  -- club_members: leaving the club takes the vote with it.
  delete from public.club_pace_votes where club_id = old.club_id and user_id = old.user_id;
  return old;
end;
$$;
revoke execute on function private.clear_club_pace_votes() from public, anon, authenticated;

drop trigger if exists book_clubs_clear_pace_votes on public.book_clubs;
create trigger book_clubs_clear_pace_votes
  after update of chapters_per_week on public.book_clubs
  for each row execute function private.clear_club_pace_votes();

drop trigger if exists club_members_clear_pace_vote on public.club_members;
create trigger club_members_clear_pace_vote
  after delete on public.club_members
  for each row execute function private.clear_club_pace_votes();
