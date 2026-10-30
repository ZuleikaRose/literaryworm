-- What's new: search by author (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Search by author$lw$, $lw$Search can now find books by who wrote them: choose Author above the search box and type any part of a name, such as tolkien or le guin. Title search works as before.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Search by author$lw$ and c.version = $lw$2026.10$lw$);
