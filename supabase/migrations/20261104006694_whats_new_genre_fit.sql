-- What's new: the BISAC genres keep only books filed under their heading. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'update', $lw$Genres that fit better$lw$, $lw$Genres such as Pets, Cooking and House & Home now show only books filed under that subject, so a novel that just has the word in its title no longer turns up there. This applies when you browse a genre and when you narrow a search to one.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Genres that fit better$lw$ and c.version = '2026.11');
