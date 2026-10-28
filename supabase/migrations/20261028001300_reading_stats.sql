-- Reading stats and Year in Review (Phase 17).
--
-- reading_days.listening_minutes: of a day's minutes, how many were spent
-- listening to an audiobook (the rest is reading). Never more than the minutes.
--
-- finished_books: which book a profile finished on which day, so Year in Review
-- can list the year's books, their genres and authors. One row per book and day
-- (finishing a book again on another day is another row). Written only through
-- record_reading(), which now takes the listening minutes and the book.

alter table public.reading_days
  add column listening_minutes smallint not null default 0
    check (listening_minutes between 0 and 1440 and listening_minutes <= minutes);

grant insert (listening_minutes) on public.reading_days to authenticated;
grant update (listening_minutes) on public.reading_days to authenticated;

create table public.finished_books (
  profile_id  uuid not null,
  user_id     uuid not null,
  -- A catalog id or a Google Books volume id, in the format library_items uses.
  volume_id   text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  finished_on date not null check (finished_on >= date '2020-01-01'),
  created_at  timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id, finished_on),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.finished_books enable row level security;

create policy "Readers see their own finished books" on public.finished_books for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers record their own finished books" on public.finished_books for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers clear their own finished books" on public.finished_books for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.finished_books from anon, authenticated;
grant select, delete on public.finished_books to authenticated;
grant insert (profile_id, user_id, volume_id, finished_on) on public.finished_books to authenticated;

-- The old four-argument version is replaced: callers that leave out the new
-- arguments (older copies of the app) still work, through the defaults.
drop function public.record_reading(uuid, date, integer, integer);

-- Adds a little reading to a profile's day: at most an hour (of which some may
-- be listening) and one finished book per call, for a day within two days of
-- the database's date. With a finished book's id, also records which book.
-- SECURITY INVOKER: RLS and the grants apply, so a caller can only add to their
-- own profiles' days.
create function public.record_reading(
  p_profile_id uuid,
  p_day date,
  p_minutes integer,
  p_finished integer,
  p_listening_minutes integer default 0,
  p_volume_id text default null
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
  insert into public.reading_days as d (profile_id, user_id, day, minutes, books_finished, listening_minutes)
  values (p_profile_id, (select auth.uid()), p_day, p_minutes, p_finished, p_listening_minutes)
  on conflict (profile_id, user_id, day) do update
    set minutes = least(1440, d.minutes + excluded.minutes),
        books_finished = least(100, d.books_finished + excluded.books_finished),
        listening_minutes = least(least(1440, d.minutes + excluded.minutes), d.listening_minutes + excluded.listening_minutes);
  if p_finished = 1 and p_volume_id is not null then
    insert into public.finished_books (profile_id, user_id, volume_id, finished_on)
    values (p_profile_id, (select auth.uid()), p_volume_id, p_day)
    on conflict do nothing;
  end if;
end;
$$;

revoke execute on function public.record_reading(uuid, date, integer, integer, integer, text) from public, anon;
grant execute on function public.record_reading(uuid, date, integer, integer, integer, text) to authenticated;
