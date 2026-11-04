-- What's new: a fuller demo household. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'update', $lw$A fuller demo$lw$, $lw$The demo household now shows more of what members get: Avery has two lists and highlights in Pride and Prejudice, Avery and Sam follow a sample reader and see her newest logs, and Sam and Mia follow an author each. A Kids profile's Readers page now says plainly that Kids profiles don't follow readers.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A fuller demo$lw$ and c.version = '2026.11');
