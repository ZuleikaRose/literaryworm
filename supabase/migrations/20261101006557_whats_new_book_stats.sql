-- What's new: your time with each book (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Your time with each book$lw$, $lw$A book's page now shows Your time with this book once you've read or listened to it: the time you've spent, reading and listening, the days, your pace through the book with the time left at that pace, and your biggest days. It's private to your profile.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Your time with each book$lw$ and c.version = $lw$2026.11$lw$);
