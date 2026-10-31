-- What's new: the home page's tour of the app (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$A tour of LiteraryWorm on the home page$lw$, $lw$The home page now shows what LiteraryWorm does beyond reading and listening: highlights and word review, Ask the book, goals and streaks, the private journal, book clubs, listening anywhere, reading offline and following authors. It also says how Kids profiles can ask a grown-up for a book.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A tour of LiteraryWorm on the home page$lw$ and c.version = $lw$2026.10$lw$);
