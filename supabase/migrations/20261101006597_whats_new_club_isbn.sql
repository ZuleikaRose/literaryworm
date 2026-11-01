-- What's new: finding a club's book by ISBN (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$Find a club's book by ISBN$lw$, $lw$When you start a book club, Find a book and, under My uploads, Find one of your uploads also take an ISBN (10 or 13 digits, with or without dashes), and so does Find your copy on a club's page. We look it up on Google Books and show the LiteraryWorm title or your uploaded EPUB with that title and author.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Find a club's book by ISBN$lw$ and c.version = $lw$2026.11$lw$);
