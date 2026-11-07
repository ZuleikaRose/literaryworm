-- What's new: Vote on your club's pace. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Vote on your club's pace$lw$, $lw$Members can now vote for how many chapters a week their book club reads, on the schedule card. The owner sees the votes and can use a pace with one tap.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Vote on your club's pace$lw$ and c.released_on = '2026-11-07');
