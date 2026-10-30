-- Weekly goals for every profile, not just Kids.
--
-- A grown-up or teen profile sets its own weekly reading goal from Goals, saved straight to
-- reader_profiles.weekly_goal_minutes like its name or avatar. A Kids profile's goal is still set
-- by a grown-up through the manage-profile function (with the account password): the trigger
-- refuses the browser's role any change to a Kids profile's goal, and the function, which uses the
-- service role, isn't affected.

grant update (weekly_goal_minutes) on public.reader_profiles to authenticated;

create or replace function private.guard_kids_weekly_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.weekly_goal_minutes is distinct from old.weekly_goal_minutes
     and old.age_rating = 'kids'
     and current_user = 'authenticated' then
    raise exception 'A grown-up sets a Kids profile''s weekly goal.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_kids_weekly_goal() from public, anon, authenticated;

create trigger reader_profiles_guard_kids_weekly_goal
  before update of weekly_goal_minutes on public.reader_profiles
  for each row execute function private.guard_kids_weekly_goal();
