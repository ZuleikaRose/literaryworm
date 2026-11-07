-- What's new: Bedtime listening. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Bedtime listening$lw$, $lw$A dim, quiet way to listen before sleep, in the player and the mini-player's More: it sets the sleep timer for you (the end of the chapter when that's near, otherwise 15 minutes), the sound fades out at the end, and Dimmer darkens the screen further. Kids profiles with a bedtime are offered it in the player shortly before. The end-of-chapter sleep timer now fades out everywhere, like the minutes one.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Bedtime listening$lw$ and c.released_on = '2026-11-07');
