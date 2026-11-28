-- What's new: log-in alert emails. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-27'::date, '2026.11', 'feature', $lw$An email when someone logs in$lw$, $lw$We now email you a few minutes after each new log-in to your account, naming the browser and device and the time, so you'd know straight away about a log-in that wasn't you. You can turn these emails off in Account → Sign-in, under Where you're logged in.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$An email when someone logs in$lw$ and c.released_on = '2026-11-27');
