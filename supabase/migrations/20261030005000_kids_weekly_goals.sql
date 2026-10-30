-- Weekly goals for Kids profiles (follow-up to the Kids reading report): a grown-up sets how long
-- a Kids profile aims to read or listen each week (1 to 5 hours), in the profile editor. Like the
-- daily limit it's the account holder's call, so it's set only through the manage-profile
-- function (set_weekly_goal), which re-checks the account password; the browser can read it.
-- The child sees their progress in Goals, the grown-ups in Account → Family and in the Monday
-- email, which now says whether last week's goal was reached.

alter table public.reader_profiles
  add column weekly_goal_minutes smallint check (weekly_goal_minutes in (60, 90, 120, 180, 240, 300));
grant select (weekly_goal_minutes) on public.reader_profiles to authenticated;

-- The report's rows gain the goal (the return type changes, so the function is made again).
drop function public.kids_report_week(uuid, date, date);
create function public.kids_report_week(p_user uuid, p_from date, p_to date)
returns table (
  profile_name text, minutes integer, listening_minutes integer, days_read integer, books_finished integer,
  finished_books text[], weekly_goal_minutes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name::text,
         coalesce(sum(d.minutes), 0)::integer,
         coalesce(sum(d.listening_minutes), 0)::integer,
         count(d.day) filter (where d.minutes >= 1)::integer,
         coalesce(sum(d.books_finished), 0)::integer,
         coalesce((select array_agg(f.volume_id order by f.finished_on)
                     from public.finished_books f
                    where f.profile_id = p.id and f.user_id = p_user and f.finished_on between p_from and p_to), '{}'),
         p.weekly_goal_minutes::integer
  from public.reader_profiles p
  left join public.reading_days d on d.profile_id = p.id and d.user_id = p_user and d.day between p_from and p_to
  where p.account_id = p_user and p.age_rating = 'kids'
  group by p.id, p.name, p.weekly_goal_minutes
  order by p.name;
$$;
revoke execute on function public.kids_report_week(uuid, date, date) from public, anon, authenticated;
grant execute on function public.kids_report_week(uuid, date, date) to service_role;
