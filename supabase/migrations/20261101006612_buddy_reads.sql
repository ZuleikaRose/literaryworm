-- Buddy reads: a club for two, started from a book's page in one tap. It's an ordinary club with
-- book_clubs.buddy set, so everything clubs have (spoiler-safe posts, meetings, shared highlights,
-- where everyone is) works the same; join_club() lets in one other reader and no more. The club
-- row is locked while joining, so two people using the code at once can't both get in.

alter table public.book_clubs add column buddy boolean not null default false;
grant insert (buddy) on public.book_clubs to authenticated;

create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_club uuid;
  v_buddy boolean;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Log in to join a club' using errcode = 'insufficient_privilege';
  end if;
  if not public.check_rate_limit('join_club:' || v_user::text, 20, 3600) then
    raise exception 'Too many tries. Wait an hour and try again.' using errcode = 'check_violation';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9]{10}$' then
    return null;
  end if;
  select id, buddy into v_club, v_buddy from public.book_clubs where invite_code = p_code for update;
  if v_club is null then
    return null;
  end if;
  if not exists (select 1 from public.club_members where club_id = v_club and user_id = v_user) then
    if v_buddy and (select count(*) from public.club_members where club_id = v_club) >= 2 then
      raise exception 'This buddy read already has two readers' using errcode = 'check_violation';
    end if;
    if (select count(*) from public.club_members where club_id = v_club) >= 50 then
      raise exception 'This club is full (50 members)' using errcode = 'check_violation';
    end if;
    insert into public.club_members (club_id, user_id) values (v_club, v_user);
  end if;
  return v_club;
end;
$$;
