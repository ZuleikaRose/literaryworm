-- What's new: Listen together on uploaded books. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Listen together on uploaded books$lw$, $lw$Book clubs reading an uploaded book can listen together now. Each member hears their own copy, in the voice they chose, and the session keeps everyone at the same chapter and the same share of the way through it, as the leader plays, pauses and skips.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Listen together on uploaded books$lw$ and c.released_on = '2026-11-07');
