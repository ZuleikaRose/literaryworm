-- What's new: Men's and women's voices, side by side. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'update', $lw$Men's and women's voices, side by side$lw$, $lw$The Voice menu now groups natural voices into women's and men's, and your device's voices into women's, men's and other voices for each accent, so a man's voice is easy to find for any classic, read-along or upload. Under Who reads whom each voice says whether it's a man's or a woman's, to match a character. Men's voices have every feature women's have: previews, speeds, character voices, pronunciations, Voice the whole book and clips.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Men's and women's voices, side by side$lw$ and c.released_on = '2026-11-08');
