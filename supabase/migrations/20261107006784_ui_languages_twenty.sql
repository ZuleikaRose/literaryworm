-- The app in the 20 languages natural voices read: the 13 added to UI_LANGUAGES in
-- src/lib/i18n.ts (Japanese, Chinese, Korean, Hindi, Arabic, Polish, Russian, Turkish, Swedish,
-- Ukrainian, Tagalog, Bulgarian, Romanian) can be kept as a profile's language too.

alter table public.reader_profiles drop constraint if exists reader_profiles_ui_language_check;
alter table public.reader_profiles
  add constraint reader_profiles_ui_language_check
  check (ui_language is null or ui_language in (
    'en', 'es', 'fr', 'de', 'pt', 'it', 'nl',
    'ja', 'zh', 'ko', 'hi', 'ar', 'pl', 'ru', 'tr', 'sv', 'uk', 'tl', 'bg', 'ro'
  ));
