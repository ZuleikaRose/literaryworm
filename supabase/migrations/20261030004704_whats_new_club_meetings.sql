-- What's new: book club meetings (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Book club meetings$lw$, $lw$Whoever started a book club can now schedule its meetings. Everyone in the club sees them on the club page, can add them to their calendar in one tap, and gets an email reminder the day before.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Book club meetings$lw$ and c.version = $lw$2026.10$lw$);
