-- What's new: See who's using the hours. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$See who's using the hours$lw$, $lw$Account → Family now shows each profile's audiobook listening and new natural-voice reading this month, so you can see where your plan's hours go.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$See who's using the hours$lw$ and c.released_on = '2026-11-07');
