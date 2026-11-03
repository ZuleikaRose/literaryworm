-- The app's language follows the profile (story 67): the language a profile chooses in the
-- accessibility menu is saved here in the background, so every device it's used on opens in it.
-- Null until chosen (a visit starts in the browser's language). The codes match UI_LANGUAGES in
-- src/lib/i18n.ts.

alter table public.reader_profiles
  add column ui_language text check (ui_language is null or ui_language in ('en', 'es', 'fr', 'de', 'pt', 'it', 'nl'));

grant select (ui_language) on public.reader_profiles to authenticated;
grant update (ui_language) on public.reader_profiles to authenticated;
