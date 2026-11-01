-- Where everyone is in a book club's book. A member chooses, per club, to show their place
-- (club_members.share_place, off until they turn it on); club_places() then gives the other
-- members their chapter, how far through and whether they've finished, from reading_progress,
-- which stays private to the account otherwise. Members only; only members who share. A chapter
-- number isn't a spoiler; posts past the reader's chapter stay hidden as before.

alter table public.club_members add column share_place boolean not null default false;

-- Members change it on their own row ("Members change their own membership", migration 1823's policy).
grant update (share_place) on public.club_members to authenticated;

create or replace function public.club_places(p_club uuid)
returns table (user_id uuid, display_name text, chapter_index smallint, fraction numeric, finished boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  if not public.second_step_done() then
    raise exception 'Enter the code from your authenticator app first.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.club_members m where m.club_id = p_club and m.user_id = v_user) then
    raise exception 'Only the club''s members can see where everyone is.' using errcode = '42501';
  end if;
  return query
  select m.user_id, p.display_name, rp.chapter_index, rp.position, rp.finished, rp.updated_at
  from public.club_members m
  join public.book_clubs c on c.id = m.club_id
  join public.reading_progress rp on rp.user_id = m.user_id and rp.volume_id = c.volume_id
  left join public.profiles p on p.id = m.user_id
  where m.club_id = p_club and m.share_place
  order by rp.position desc, p.display_name;
end;
$$;

revoke execute on function public.club_places(uuid) from public, anon;
grant execute on function public.club_places(uuid) to authenticated;
