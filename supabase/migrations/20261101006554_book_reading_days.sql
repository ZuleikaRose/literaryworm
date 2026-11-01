-- Reading statistics for each book: a profile's minutes with one book on one day, how many of
-- them were listening, and where in the book the day started and ended (0–1), so the book page
-- can show time spent, pace and the biggest days. record_reading() fills it when the app says
-- which book and where it is (p_volume_id, now also for minutes, and the new p_fraction); old
-- copies of the app that don't send them still record the day as before. Private to the account,
-- like reading_days. The primary key covers the foreign key; user_id gets its own index (RLS) in
-- the next migration.

create table public.book_reading_days (
  profile_id        uuid not null,
  user_id           uuid not null,
  volume_id         text not null check (char_length(volume_id) between 1 and 64),
  day               date not null check (day >= date '2020-01-01'),
  minutes           smallint not null default 0 check (minutes between 0 and 1440),
  listening_minutes smallint not null default 0 check (listening_minutes between 0 and 1440),
  fraction_from     numeric(5, 4) check (fraction_from between 0 and 1),
  fraction_to       numeric(5, 4) check (fraction_to between 0 and 1),
  primary key (profile_id, user_id, volume_id, day),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.book_reading_days enable row level security;

create policy "Readers see their own book days" on public.book_reading_days for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers record their own book days" on public.book_reading_days for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers add to their own book days" on public.book_reading_days for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own book days" on public.book_reading_days for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.book_reading_days as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.book_reading_days from anon, authenticated;
grant select, delete on public.book_reading_days to authenticated;
grant insert (profile_id, user_id, volume_id, day, minutes, listening_minutes, fraction_from, fraction_to) on public.book_reading_days to authenticated;
grant update (minutes, listening_minutes, fraction_to) on public.book_reading_days to authenticated;

drop function public.record_reading(uuid, date, integer, integer, integer, text);
create function public.record_reading(
  p_profile_id uuid,
  p_day date,
  p_minutes integer,
  p_finished integer,
  p_listening_minutes integer default 0,
  p_volume_id text default null,
  p_fraction numeric default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_minutes is null or p_minutes not between 0 and 60 then
    raise exception 'minutes must be 0 to 60' using errcode = 'check_violation';
  end if;
  if p_listening_minutes is null or p_listening_minutes not between 0 and p_minutes then
    raise exception 'listening minutes must be 0 to the minutes' using errcode = 'check_violation';
  end if;
  if p_finished is null or p_finished not between 0 and 1 then
    raise exception 'finished must be 0 or 1' using errcode = 'check_violation';
  end if;
  if p_day is null or p_day not between current_date - 2 and current_date + 2 then
    raise exception 'day must be within two days of today' using errcode = 'check_violation';
  end if;
  if p_fraction is not null and p_fraction not between 0 and 1 then
    raise exception 'fraction must be 0 to 1' using errcode = 'check_violation';
  end if;
  insert into public.reading_days as d (profile_id, user_id, day, minutes, books_finished, listening_minutes)
  values (p_profile_id, (select auth.uid()), p_day, p_minutes, p_finished, p_listening_minutes)
  on conflict (profile_id, user_id, day) do update
    set minutes = least(1440, d.minutes + excluded.minutes),
        books_finished = least(100, d.books_finished + excluded.books_finished),
        listening_minutes = least(least(1440, d.minutes + excluded.minutes), d.listening_minutes + excluded.listening_minutes);
  if p_volume_id is not null and p_minutes > 0 then
    insert into public.book_reading_days as b (profile_id, user_id, volume_id, day, minutes, listening_minutes, fraction_from, fraction_to)
    values (p_profile_id, (select auth.uid()), p_volume_id, p_day, p_minutes, p_listening_minutes, p_fraction, p_fraction)
    on conflict (profile_id, user_id, volume_id, day) do update
      set minutes = least(1440, b.minutes + excluded.minutes),
          listening_minutes = least(least(1440, b.minutes + excluded.minutes), b.listening_minutes + excluded.listening_minutes),
          fraction_to = coalesce(excluded.fraction_to, b.fraction_to);
  end if;
  if p_finished = 1 and p_volume_id is not null then
    insert into public.finished_books (profile_id, user_id, volume_id, finished_on)
    values (p_profile_id, (select auth.uid()), p_volume_id, p_day)
    on conflict do nothing;
  end if;
end;
$$;

revoke execute on function public.record_reading(uuid, date, integer, integer, integer, text, numeric) from public, anon;
grant execute on function public.record_reading(uuid, date, integer, integer, integer, text, numeric) to authenticated;
