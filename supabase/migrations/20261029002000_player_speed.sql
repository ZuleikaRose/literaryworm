-- The audiobook player's speed joins the other player settings on the profile
-- (Phase 13 kept it for the session only). One of the speeds the player offers.

alter table public.reader_profiles
  add column playback_speed numeric(3, 2) not null default 1
    check (playback_speed in (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3));

grant select (playback_speed) on public.reader_profiles to authenticated;
grant update (playback_speed) on public.reader_profiles to authenticated;
