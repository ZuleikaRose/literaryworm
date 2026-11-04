-- What's new: the endless Keep discovering says which genre it's showing, offers Back to top, and skips drawing
-- books far off screen. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'update', $lw$Keep discovering stays quick, with Back to top$lw$, $lw$Members' Keep discovering on Home now says which genre it has reached as it runs on from one to the next, and once it's long it offers Back to top of the feed. Books far off the screen aren't drawn until you come near them, so a long scroll stays smooth on older phones.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Keep discovering stays quick, with Back to top$lw$ and c.version = '2026.11');
