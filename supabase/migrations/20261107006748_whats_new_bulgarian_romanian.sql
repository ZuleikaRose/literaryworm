-- What's new: Natural voices in Bulgarian and Romanian. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Natural voices in Bulgarian and Romanian$lw$, $lw$Natural voices now read your Bulgarian and Romanian uploads in their own language, with Character voices that find who's talking there too. That makes 20 languages in all.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices in Bulgarian and Romanian$lw$ and c.released_on = '2026-11-07');
