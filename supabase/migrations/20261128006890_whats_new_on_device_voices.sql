-- What's new: natural voices that run on the device. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'feature', $lw$Natural voices that run on your device$lw$, $lw$Members can now choose Linda or Norman, natural American English voices that run on your own device, for any book in English. Each downloads once (about 64 MB), then starts within a few seconds, works offline and is free, without counting towards your natural-voice hours. The text never leaves your device. Find them in the player's Voice menu.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices that run on your device$lw$ and c.released_on = '2026-11-28');
