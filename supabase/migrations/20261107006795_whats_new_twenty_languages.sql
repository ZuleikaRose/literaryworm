-- What's new: LiteraryWorm in 20 languages. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$LiteraryWorm in 20 languages$lw$, $lw$The app now speaks the same 20 languages as our natural voices. Besides English, Spanish, French, German, Portuguese, Italian and Dutch, choose 日本語, 中文（简体）, 한국어, हिन्दी, العربية, Polski, Русский, Türkçe, Svenska, Українська, Tagalog, Български or Română in the accessibility menu. Arabic reads right to left, and your profile keeps the language on every device. Book details, emails, the policies and Help stay in English.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$LiteraryWorm in 20 languages$lw$ and c.released_on = '2026-11-07');
