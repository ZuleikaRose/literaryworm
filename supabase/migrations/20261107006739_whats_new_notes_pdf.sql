-- What's new: Export your notes as a PDF. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Export your notes as a PDF$lw$, $lw$My Library → Notes now saves a book's highlights, notes and journal, or all of them, as a tidy PDF as well as Markdown and plain text: chapters in order, each quote marked, with its page and your note. It's made on your device.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Export your notes as a PDF$lw$ and c.released_on = '2026-11-07');
