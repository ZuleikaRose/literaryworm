-- What's new: Character voices know who's talking. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$Character voices know who's talking$lw$, $lw$Character voices now follow two people talking in turn, even where only "he said" is written, and find speakers named in French, German and Spanish books as well as English ones.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Character voices know who's talking$lw$ and c.released_on = '2026-11-07');
