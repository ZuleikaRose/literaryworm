-- What's new: the Search page's Filters scroll on their own on a computer. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'fix', $lw$Search filters scroll on a computer$lw$, $lw$On Search, the Filters beside the results now scroll on their own when they're taller than your window, so Length and Sort by are always within reach.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Search filters scroll on a computer$lw$ and c.version = '2026.11');
