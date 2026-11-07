-- What's new: Bedtime in the Kids reading report. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Bedtime in the Kids reading report$lw$, $lw$Account → Family and the Monday email now show, for each Kids profile with a bedtime, how many nights of the last week it was kept, and how long it spent in Bedtime listening.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Bedtime in the Kids reading report$lw$ and c.released_on = '2026-11-07');
