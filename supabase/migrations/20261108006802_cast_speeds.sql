-- A speed per character (Who reads whom in Player settings, lib/castSpeeds.ts): per profile and
-- book, speaker (lower case) to 0.8, 0.9, 1.1 or 1.2, times the player's speed. Saved with the
-- other player settings; nothing is voiced again, so it never reaches Google.

alter table public.reader_profiles
  add column if not exists cast_speeds jsonb not null default '{}'::jsonb;

alter table public.reader_profiles drop constraint if exists reader_profiles_cast_speeds_check;
alter table public.reader_profiles
  add constraint reader_profiles_cast_speeds_check
  check (jsonb_typeof(cast_speeds) = 'object' and pg_column_size(cast_speeds) <= 65536);

grant select (cast_speeds) on public.reader_profiles to authenticated;
grant update (cast_speeds) on public.reader_profiles to authenticated;
