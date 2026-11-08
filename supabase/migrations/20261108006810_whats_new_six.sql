-- What's new: On this device, for an upload's voices. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'update', $lw$On this device, for an upload's voices$lw$, $lw$Under Voice the whole book, On this device shows how many voiced parts are kept and how much space they take, so you know a book is ready before a trip, and Remove the voices from this device frees the space after.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$On this device, for an upload's voices$lw$ and c.released_on = '2026-11-08');
-- What's new: Try the demo on your phone. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Try the demo on your phone$lw$, $lw$The home and log-in pages have Try the demo on your phone: scan the code and the demo opens on your phone, a sample household of its own.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Try the demo on your phone$lw$ and c.released_on = '2026-11-08');
-- What's new: Club natural-voice hours. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Club natural-voice hours$lw$, $lw$The owner of a club reading an uploaded book can give each member up to 3 hours a month of natural-voice reading for their copy, from the owner's own month, used only after a member's own hours run out.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Club natural-voice hours$lw$ and c.released_on = '2026-11-08');
-- What's new: Natural voices in the Kids report. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'update', $lw$Natural voices in the Kids report$lw$, $lw$The weekly Kids reading report and Account → Family now say when natural voices are on for a Kids profile, with this month's natural-voice reading and any share.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices in the Kids report$lw$ and c.released_on = '2026-11-08');
-- What's new: Two Greek classics. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Two Greek classics$lw$, $lw$Penelope Delta's fairy tale Παραμύθι χωρίς όνομα and Papadiamantis's Christmas stories, in Greek, with their full text and LibriVox recordings. Find them in Discover's In their own language row.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Two Greek classics$lw$ and c.released_on = '2026-11-08');
-- What's new: Character voices for the classics. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Character voices for the classics$lw$, $lw$Character voices now work with your device's voices too: when your device reads a classic's own text aloud, what the characters say is read by its other voices, each named speaker keeping one.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Character voices for the classics$lw$ and c.released_on = '2026-11-08');
