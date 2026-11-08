-- Greek joins the app's languages and the natural voices (el-GR, Chirp 3: HD): a profile can keep
-- 'el' as its interface language too. src/lib/i18n.ts UI_LANGUAGES has the same 21.

alter table public.reader_profiles drop constraint if exists reader_profiles_ui_language_check;
alter table public.reader_profiles
  add constraint reader_profiles_ui_language_check
  check (ui_language is null or ui_language in (
    'en', 'es', 'fr', 'de', 'pt', 'it', 'nl',
    'ja', 'zh', 'ko', 'hi', 'ar', 'pl', 'ru', 'tr', 'sv', 'uk', 'tl', 'bg', 'ro', 'el'
  ));
