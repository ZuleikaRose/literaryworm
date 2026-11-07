-- Who reads whom (lib/castChoices.ts, components/CastChoices.tsx): the voices a profile chose for
-- named speakers, per book, kept with its player settings as {book id: {speaker: voice}} (up to 100
-- books and 50 speakers each, checked in the browser and by the natural-voice function).

alter table public.reader_profiles
  add column if not exists cast_choices jsonb not null default '{}'::jsonb;

alter table public.reader_profiles drop constraint if exists reader_profiles_cast_choices_check;
alter table public.reader_profiles
  add constraint reader_profiles_cast_choices_check
  check (jsonb_typeof(cast_choices) = 'object' and pg_column_size(cast_choices) <= 65536);

grant select (cast_choices) on public.reader_profiles to authenticated;
grant update (cast_choices) on public.reader_profiles to authenticated;
