-- What's new: export your library for goodreads or storygraph (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Export your library for Goodreads or StoryGraph$lw$, $lw$My Library has Export for Goodreads and Export for StoryGraph: a CSV of your books, shelves, star ratings and the days you added and finished them, in that site's own layout, ready to import there. It's made on your device; nothing is uploaded.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Export your library for Goodreads or StoryGraph$lw$ and c.version = $lw$2026.11$lw$);
