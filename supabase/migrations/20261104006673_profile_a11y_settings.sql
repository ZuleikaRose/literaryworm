-- The accessibility menu follows the profile (story 61): the settings a profile chooses (text size,
-- theme, Lexend or OpenDyslexic, high contrast, underlined links, reduced motion and the read-along
-- transcript's settings) are kept here in the background, so every device it's used on opens with
-- them. The app checks each field when it reads them (parseSavedA11y() in src/lib/a11ySync.ts); the
-- database keeps them small and an object. Null until the profile changes something. The language is
-- kept on its own (ui_language, 6647). RLS on reader_profiles already limits rows to the account's own.

alter table public.reader_profiles
  add column a11y_settings jsonb
    check (a11y_settings is null or (jsonb_typeof(a11y_settings) = 'object' and octet_length(a11y_settings::text) <= 1000));

grant select (a11y_settings) on public.reader_profiles to authenticated;
grant update (a11y_settings) on public.reader_profiles to authenticated;
