-- What's new: A speed for each book. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$A speed for each book$lw$, $lw$In Player settings, Keep this speed for this book remembers how fast you like one audiobook, on every device, while your other books keep your usual speed.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A speed for each book$lw$ and c.released_on = '2026-11-07');
