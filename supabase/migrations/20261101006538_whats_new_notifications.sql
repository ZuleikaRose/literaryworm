-- What's new: notifications on your devices (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Notifications on your devices$lw$, $lw$Turn on Notifications on this device in Account → Preferences, and a book any profile set Remind me on tells you the day it comes out, on your phone, tablet or computer. Tap it to open the book. Turn it on for each device you like; logging out turns it off there. On iPhone and iPad, add LiteraryWorm to your Home Screen first.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Notifications on your devices$lw$ and c.version = $lw$2026.11$lw$);
