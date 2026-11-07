-- What's new: The read-along marks each word. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$The read-along marks each word$lw$, $lw$Where the read-along shows the book's own text, including your uploads read by a natural voice, it now underlines the word being spoken inside the sentence being read.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$The read-along marks each word$lw$ and c.released_on = '2026-11-07');
