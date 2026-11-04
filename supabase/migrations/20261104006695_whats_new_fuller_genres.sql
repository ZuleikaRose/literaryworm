-- What's new: thin genre pages top up from the next one; covers have alt text; the genres FAQ. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'update', $lw$Fuller genre pages and described covers$lw$, $lw$When a genre's page comes back with only a few books, the next page now loads straight away, so you aren't left with two books and a button. Book covers now tell screen readers which book they show, and the FAQ answers which genres you can browse.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Fuller genre pages and described covers$lw$ and c.version = '2026.11');
