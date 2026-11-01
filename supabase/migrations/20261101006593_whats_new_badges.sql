-- What's new: 16 new badges (src/data/changelog.json has the same). Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$16 new badges$lw$, $lw$My Library → Badges now has 30 badges. New ones: 25 and 100 books, two weeks and 100 days in a row, 100 reading days, a three-hour marathon day, 50 and 250 hours, your first hour and 50 hours of listening, 10 genres, a book in another language, 25 classics, three series, 50 words and 100 highlights. They're worked out from what you already read, listen to and keep, so any you've already earned show straight away.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$16 new badges$lw$ and c.version = $lw$2026.11$lw$);
