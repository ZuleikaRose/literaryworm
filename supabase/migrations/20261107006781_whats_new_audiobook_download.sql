-- What's new: Save your upload as an audiobook. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Save your upload as an audiobook$lw$, $lw$After Voice the whole book, choose Download the audiobook to save every part as one MP3, made on your device, to play in any audio app.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Save your upload as an audiobook$lw$ and c.released_on = '2026-11-07');
