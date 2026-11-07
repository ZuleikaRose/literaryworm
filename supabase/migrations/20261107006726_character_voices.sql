-- Character voices (lib/naturalVoice.ts chapterPieces(), Player settings): a player setting per
-- profile, like skipping intros. Natural voices on uploads read what the characters say in other
-- voices. Kept with the other player settings; the profile's own account reads and changes it.

alter table public.reader_profiles
  add column if not exists character_voices boolean not null default false;

grant select (character_voices) on public.reader_profiles to authenticated;
grant update (character_voices) on public.reader_profiles to authenticated;
