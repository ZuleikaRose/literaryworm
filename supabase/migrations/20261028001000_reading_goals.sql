-- Reading goals and streaks (Phase 12).
--
-- Like favourites and lists, these belong to one household profile: every row
-- carries the account (user_id) for RLS and a composite foreign key to
-- reader_profiles(id, account_id), so the profile must be the account's and
-- deleting the profile or the account deletes its rows. Keys start with
-- (profile_id, user_id), so they also index those foreign keys.
--
-- reading_goals: a profile's target number of books for a year.
-- reading_days: minutes read or listened and books finished, per profile per
-- day (the device's date). Streaks and monthly summaries are worked out from
-- these rows in the app. The app adds to a day through record_reading(), which
-- adds atomically, so two tabs can't overwrite each other's minutes.

create table public.reading_goals (
  profile_id uuid not null,
  user_id    uuid not null,
  year       smallint not null check (year between 2020 and 2100),
  books      smallint not null check (books between 1 and 365),
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id, year),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create trigger reading_goals_set_updated_at
  before update on public.reading_goals
  for each row execute function public.set_updated_at();

create table public.reading_days (
  profile_id     uuid not null,
  user_id        uuid not null,
  day            date not null check (day >= date '2020-01-01'),
  minutes        smallint not null default 0 check (minutes between 0 and 1440),
  books_finished smallint not null default 0 check (books_finished between 0 and 100),
  primary key (profile_id, user_id, day),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.reading_goals enable row level security;
alter table public.reading_days enable row level security;

create policy "Readers see their own goals" on public.reading_goals for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers set their own goals" on public.reading_goals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers change their own goals" on public.reading_goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own goals" on public.reading_goals for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own reading days" on public.reading_days for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers record their own reading days" on public.reading_days for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers add to their own reading days" on public.reading_days for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own reading days" on public.reading_days for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.reading_goals, public.reading_days from anon, authenticated;
grant select, delete on public.reading_goals to authenticated;
grant insert (profile_id, user_id, year, books) on public.reading_goals to authenticated;
grant update (books) on public.reading_goals to authenticated;
grant select, delete on public.reading_days to authenticated;
grant insert (profile_id, user_id, day, minutes, books_finished) on public.reading_days to authenticated;
grant update (minutes, books_finished) on public.reading_days to authenticated;

-- Adds a little reading to a profile's day: at most an hour and one finished
-- book per call, for a day within two days of the database's date (devices sit
-- in different time zones). SECURITY INVOKER: RLS and the grants above apply,
-- so a caller can only add to their own profiles' days.
create or replace function public.record_reading(p_profile_id uuid, p_day date, p_minutes integer, p_finished integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_minutes is null or p_minutes not between 0 and 60 then
    raise exception 'minutes must be 0 to 60' using errcode = 'check_violation';
  end if;
  if p_finished is null or p_finished not between 0 and 1 then
    raise exception 'finished must be 0 or 1' using errcode = 'check_violation';
  end if;
  if p_day is null or p_day not between current_date - 2 and current_date + 2 then
    raise exception 'day must be within two days of today' using errcode = 'check_violation';
  end if;
  insert into public.reading_days as d (profile_id, user_id, day, minutes, books_finished)
  values (p_profile_id, (select auth.uid()), p_day, p_minutes, p_finished)
  on conflict (profile_id, user_id, day) do update
    set minutes = least(1440, d.minutes + excluded.minutes),
        books_finished = least(100, d.books_finished + excluded.books_finished);
end;
$$;

revoke execute on function public.record_reading(uuid, date, integer, integer) from public, anon;
grant execute on function public.record_reading(uuid, date, integer, integer) to authenticated;
