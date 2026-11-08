-- What's new: Year in reading, by email. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Year in reading, by email$lw$, $lw$Turn on Year in reading in Account → Preferences and each January we'll email your household's year just ended: every profile's time read and listened, days read, books finished and the month it read most. It's off until you turn it on, and every email has a one-click unsubscribe.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Year in reading, by email$lw$ and c.released_on = '2026-11-07');
