-- The weekly Kids reading report names each Kids profile's natural-voice reading this month: whether
-- a grown-up turned natural voices on for it (reader_profiles.kids_natural_voices, 6799), the minutes
-- voiced in the month the week ends in (natural_voice_profile_usage, 6776; 840 characters a minute,
-- as CHARACTERS_PER_HOUR 50400), and its own monthly share if set (monthly_voice_minutes, 6800).
-- Kept per month, so it's the month so far, not the week. Same rights as before: service role only.

drop function if exists public.kids_report_week(uuid, date, date);
create function public.kids_report_week(p_user uuid, p_from date, p_to date)
returns table (
  profile_name text, minutes integer, listening_minutes integer, days_read integer, books_finished integer,
  finished_books text[], weekly_goal_minutes integer, has_bedtime boolean, bedtime_minutes integer, late_nights integer,
  natural_voices boolean, voice_minutes integer, voice_share_minutes integer
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
         count(d.day) filter (where d.late_minutes >= 1)::integer,
         p.kids_natural_voices,
         coalesce((select round(u.characters / 840.0)::integer
                     from public.natural_voice_profile_usage u
                    where u.account_id = p_user and u.profile_id = p.id
                      and u.month = date_trunc('month', p_to)::date), 0),
         p.monthly_voice_minutes::integer
  from public.reader_profiles p
  left join public.reading_days d on d.profile_id = p.id and d.user_id = p_user and d.day between p_from and p_to
  where p.account_id = p_user and p.age_rating = 'kids'
  group by p.id, p.name, p.weekly_goal_minutes, p.bedtime, p.kids_natural_voices, p.monthly_voice_minutes
  order by p.name;
$$;

revoke execute on function public.kids_report_week(uuid, date, date) from public, anon, authenticated;
grant execute on function public.kids_report_week(uuid, date, date) to service_role;
