-- What's new: Hear character voices in the demo. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$Hear character voices in the demo$lw$, $lw$The demo's sample upload The Tide Clock is now read by natural voices, with Juno and Ezra in voices of their own when Character voices is on. Choose who reads whom and hear the change straight away.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Hear character voices in the demo$lw$ and c.released_on = '2026-11-07');
