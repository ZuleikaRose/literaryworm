-- What's new: Read along on the page. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Read along on the page$lw$, $lw$In the reader, books you uploaded can now be read aloud by their natural voice right on the page: the pages turn with the voice, and the word being spoken is marked as you go.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Read along on the page$lw$ and c.released_on = '2026-11-07');
