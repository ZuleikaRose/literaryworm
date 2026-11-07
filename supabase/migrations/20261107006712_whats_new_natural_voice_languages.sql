-- What's new: natural voices in 17 languages besides English. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Natural voices in 17 languages$lw$, $lw$Natural voices for your uploads now also read Japanese, Chinese (Mandarin), Korean, Hindi, Arabic, Polish, Russian, Turkish, Swedish, Ukrainian and Tagalog books in their own language, as well as French, German, Spanish, Italian, Portuguese and Dutch. The player finds a book's language in its EPUB when you upload it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices in 17 languages$lw$ and c.version = '2026.11');
