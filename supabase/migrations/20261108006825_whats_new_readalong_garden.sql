-- What's new: True read-along for The Secret Garden. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$True read-along for The Secret Garden$lw$, $lw$The Secret Garden now shows the book's own text in the player's Read-along while its LibriVox recording plays, each sentence marked as the reader says it. That makes fifteen classics with a true read-along.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$True read-along for The Secret Garden$lw$ and c.released_on = '2026-11-08');
