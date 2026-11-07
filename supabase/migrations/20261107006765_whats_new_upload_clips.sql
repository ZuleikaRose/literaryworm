-- What's new: Clips from your own books. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Clips from your own books$lw$, $lw$Share a clip now works for books you uploaded and hear in a natural voice: a link to the part you're listening to, which plays only for your household.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Clips from your own books$lw$ and c.released_on = '2026-11-07');
