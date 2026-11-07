-- Pronunciations (lib/pronunciations.ts, components/Pronunciations.tsx): a profile's respellings of
-- names a natural voice says wrongly, per book, kept with its player settings as
-- {book id: {word: how it sounds}} (up to 100 books and 50 words each, checked in the browser and
-- by the natural-voice function).

alter table public.reader_profiles
  add column if not exists pronunciations jsonb not null default '{}'::jsonb;

alter table public.reader_profiles drop constraint if exists reader_profiles_pronunciations_check;
alter table public.reader_profiles
  add constraint reader_profiles_pronunciations_check
  check (jsonb_typeof(pronunciations) = 'object' and pg_column_size(pronunciations) <= 131072);

grant select (pronunciations) on public.reader_profiles to authenticated;
grant update (pronunciations) on public.reader_profiles to authenticated;
