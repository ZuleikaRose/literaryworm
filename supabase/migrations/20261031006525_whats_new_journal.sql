-- What's new: the reading journal (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$A private reading journal$lw$, $lw$Every book's page now has My journal: dated notes about the book that only you see, apart from the public reader logs. Write, edit and delete entries, and export them with your highlights from My Library → Notes.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A private reading journal$lw$ and c.version = $lw$2026.10$lw$);
