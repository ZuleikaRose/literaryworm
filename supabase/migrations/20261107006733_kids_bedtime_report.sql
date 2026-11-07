-- Bedtime in the Kids reading report (lib/kidsReport.ts bedtimeWeek(), kids-report email
-- bedtimeLine()): per Kids profile and day, minutes in Bedtime listening and minutes read or
-- listened after bedtime (only possible when a grown-up allowed more). Added through
-- record_bedtime() like record_reading(); kids_report_week() returns them with whether the
-- profile has a bedtime.

alter table public.reading_days
  add column if not exists bedtime_minutes smallint not null default 0 check (bedtime_minutes between 0 and 1440),
  add column if not exists late_minutes smallint not null default 0 check (late_minutes between 0 and 1440);

grant select (bedtime_minutes, late_minutes) on public.reading_days to authenticated;
grant insert (bedtime_minutes, late_minutes) on public.reading_days to authenticated;
grant update (bedtime_minutes, late_minutes) on public.reading_days to authenticated;

create or replace function public.record_bedtime(
  p_profile_id uuid,
  p_day date,
  p_bedtime_minutes integer,
  p_late_minutes integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_bedtime_minutes is null or p_bedtime_minutes not between 0 and 60
     or p_late_minutes is null or p_late_minutes not between 0 and 60 then
    raise exception 'minutes must be 0 to 60' using errcode = 'check_violation';
  end if;
  if p_day is null or p_day not between current_date - 2 and current_date + 2 then
    raise exception 'day must be within two days of today' using errcode = 'check_violation';
  end if;
  insert into public.reading_days as d (profile_id, user_id, day, minutes, books_finished, bedtime_minutes, late_minutes)
  values (p_profile_id, (select auth.uid()), p_day, 0, 0, p_bedtime_minutes, p_late_minutes)
  on conflict (profile_id, user_id, day) do update
    set bedtime_minutes = least(1440, d.bedtime_minutes + excluded.bedtime_minutes),
        late_minutes = least(1440, d.late_minutes + excluded.late_minutes);
end;
$$;

revoke execute on function public.record_bedtime(uuid, date, integer, integer) from public, anon;
grant execute on function public.record_bedtime(uuid, date, integer, integer) to authenticated;

drop function if exists public.kids_report_week(uuid, date, date);
create function public.kids_report_week(p_user uuid, p_from date, p_to date)
returns table (
  profile_name text, minutes integer, listening_minutes integer, days_read integer, books_finished integer,
  finished_books text[], weekly_goal_minutes integer, has_bedtime boolean, bedtime_minutes integer, late_nights integer
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
         p.weekly_goal_minutes::integer,
         p.bedtime is not null,
         coalesce(sum(d.bedtime_minutes), 0)::integer,
         count(d.day) filter (where d.late_minutes >= 1)::integer
  from public.reader_profiles p
  left join public.reading_days d on d.profile_id = p.id and d.user_id = p_user and d.day between p_from and p_to
  where p.account_id = p_user and p.age_rating = 'kids'
  group by p.id, p.name, p.weekly_goal_minutes, p.bedtime
  order by p.name;
$$;
revoke execute on function public.kids_report_week(uuid, date, date) from public, anon, authenticated;
grant execute on function public.kids_report_week(uuid, date, date) to service_role;
