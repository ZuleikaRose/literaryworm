-- What's new: My library sorts by author Z–A (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Sort My library by author Z–A$lw$, $lw$My library's Sort by now has Author Z–A as well as A–Z, by the author's surname.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Sort My library by author Z–A$lw$ and c.version = $lw$2026.10$lw$);
