-- What's new: Natural voices in the free week. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$Natural voices in the free week$lw$, $lw$A first membership's free week now includes 1 hour of natural-voice reading; your plan's full hours start with your first payment. If a payment fails, natural voices pause until one goes through.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices in the free week$lw$ and c.released_on = '2026-11-07');
