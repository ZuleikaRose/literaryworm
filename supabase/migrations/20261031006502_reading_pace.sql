-- Time left: each profile's reading pace, in words a minute.
--
-- The reader learns it from how long the profile stays on each page and saves it
-- here in the background, so every device works out the time left in a chapter
-- and the book from the same pace. Null until the reader has one (it then uses a
-- usual pace of 230 words a minute).

alter table public.reader_profiles
  add column reading_wpm smallint check (reading_wpm is null or reading_wpm between 60 and 1000);

grant select (reading_wpm) on public.reader_profiles to authenticated;
grant update (reading_wpm) on public.reader_profiles to authenticated;
