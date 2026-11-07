-- What's new: Voice a whole upload for offline listening. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Voice a whole upload for offline listening$lw$, $lw$In the player, Voice the whole book (under the natural voice reading your upload) has your natural voice read every part now, on Wi-Fi, and keeps it on your device, so the whole book plays offline. Parts already voiced don't count towards the month's natural-voice reading.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Voice a whole upload for offline listening$lw$ and c.released_on = '2026-11-07');
