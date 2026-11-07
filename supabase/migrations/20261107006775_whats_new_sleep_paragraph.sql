-- What's new: The sleep timer finishes the paragraph. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$The sleep timer finishes the paragraph$lw$, $lw$When a voice reads the book's text, the sleep timer now runs on to the end of the paragraph, up to two minutes more, so you drift off at a break rather than mid-sentence.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$The sleep timer finishes the paragraph$lw$ and c.released_on = '2026-11-07');
