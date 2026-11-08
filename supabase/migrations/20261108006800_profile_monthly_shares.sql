-- Shared listening hours: a grown-up can give any profile its own monthly share of the household's
-- audiobook hours and natural-voice reading (Account → Family, the profile editor). Written only by
-- the manage-profile function (set_monthly_share, which re-checks the account password); the
-- browser can read them. Null is no share of its own (the household's hours are the only limit).
-- Audiobook listening is held to it in the player (lib/useListeningAllowance.ts, from the profile's
-- reading_days); natural voices by the natural-voice function, from natural_voice_profile_usage.

alter table public.reader_profiles
  add column if not exists monthly_listening_minutes smallint
    check (monthly_listening_minutes in (60, 120, 180, 300, 600, 900, 1200, 1800)),
  add column if not exists monthly_voice_minutes smallint
    check (monthly_voice_minutes in (30, 60, 120, 180, 300, 600));
grant select (monthly_listening_minutes, monthly_voice_minutes) on public.reader_profiles to authenticated;
