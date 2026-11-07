-- What's new: Fix how a name is said. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Fix how a name is said$lw$, $lw$If a natural voice says a name wrong in one of your uploads, spell how it sounds under Pronunciations in Player settings. Only the parts with that name are read again, and the page keeps the book's spelling.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Fix how a name is said$lw$ and c.released_on = '2026-11-07');
