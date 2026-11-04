-- What's new: Search in a member's header menu. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'update', $lw$Search in the menu when you're logged in$lw$, $lw$The header menu now has Search between Discover and My Library when you're logged in, so the full Search page, with its filters and genres, is a click away, as it already was on a phone. The header also fits better on smaller laptop screens.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Search in the menu when you're logged in$lw$ and c.version = '2026.11');
