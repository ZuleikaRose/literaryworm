-- Who reads whom with a device voice (lib/deviceCastChoices.ts): for the classics' own text (and
-- uploads read by the device), per profile and book, speaker (lower case) to the name of one of the
-- device's voices. Saved with the other player settings; voices are the browser's own, so nothing
-- is sent anywhere. A voice another device doesn't have is dealt out there instead.

alter table public.reader_profiles
  add column if not exists device_cast_choices jsonb not null default '{}'::jsonb;

alter table public.reader_profiles drop constraint if exists reader_profiles_device_cast_choices_check;
alter table public.reader_profiles
  add constraint reader_profiles_device_cast_choices_check
  check (jsonb_typeof(device_cast_choices) = 'object' and pg_column_size(device_cast_choices) <= 65536);

grant select (device_cast_choices) on public.reader_profiles to authenticated;
grant update (device_cast_choices) on public.reader_profiles to authenticated;
