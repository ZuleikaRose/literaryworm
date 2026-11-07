-- What's new: Character voices for your uploads. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Character voices for your uploads$lw$, $lw$Turn on Character voices in Player settings and a natural voice reading your upload hands what the characters say to other voices. Anyone named beside their words, as in "said Elizabeth", keeps the same voice all book long. Chapters with no speech are read as before.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Character voices for your uploads$lw$ and c.released_on = '2026-11-07');
