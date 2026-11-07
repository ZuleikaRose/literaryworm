-- What's new: Reading schedules for book clubs. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Reading schedules for book clubs$lw$, $lw$A club's owner can now set how many chapters a week the club reads. Everyone sees this week's chapters on the club's page, and whether they're on track, ahead or behind, and the bell reminds them until they've read it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Reading schedules for book clubs$lw$ and c.released_on = '2026-11-07');
