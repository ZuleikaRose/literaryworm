-- What's new: 39 on-device voices. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'feature', $lw$39 voices on your device, in eight English accents$lw$, $lw$The natural voices that run on your device now come in American, British, Scottish, Irish, Canadian, Australian, New Zealand and South African English: 39 voices in all, women's, men's and a non-binary voice. Like Linda and Norman, each downloads once, then works offline for free, and the text never leaves your device. Find them in the player's Voice menu.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$39 voices on your device, in eight English accents$lw$ and c.released_on = '2026-11-28');
