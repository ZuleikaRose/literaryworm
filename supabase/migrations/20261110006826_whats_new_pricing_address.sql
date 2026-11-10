-- What's new: Plans and pricing moves from /plans to /pricing. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-10'::date, '2026.11', 'update', $lw$Plans and pricing has a new address$lw$, $lw$Plans and pricing now lives at www.literaryworm.com/pricing. Old links to /plans still work and take you straight there.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Plans and pricing has a new address$lw$ and c.released_on = '2026-11-10');
