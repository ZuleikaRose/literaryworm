-- What's new: LiteraryWorm by Zuleika LLC. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'update', $lw$Who runs LiteraryWorm$lw$, $lw$LiteraryWorm is run by Zuleika LLC. The footer says so, and every policy now names the company with its postal address: 1207 Delaware Ave Ste 4418, Wilmington, DE 19806.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Who runs LiteraryWorm$lw$ and c.released_on = '2026-11-28');
