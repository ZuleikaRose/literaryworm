-- What's new: Choose who reads each character. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Choose who reads each character$lw$, $lw$With Character voices on, Player settings now lists your upload's named speakers under Who reads whom: pick a voice for anyone, and the rest keep the voices chosen for them.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Choose who reads each character$lw$ and c.released_on = '2026-11-07');
