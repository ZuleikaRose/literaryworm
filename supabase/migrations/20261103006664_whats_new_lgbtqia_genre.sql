-- LGBTQIA+ as a twentieth genre (src/data/genres.ts and the books function's GENRES). This adds its What's
-- new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'update', $lw$LGBTQIA+ books to browse and search$lw$, $lw$LGBTQIA+ is now a genre on Home's Keep discovering, Discover, Search's Or browse a genre and the genre filter, and among the favourite genres for a profile. Its books come from Google Books, which files them under LGBTQ+; like every list, titles Google marks as mature are left out.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$LGBTQIA+ books to browse and search$lw$ and c.version = '2026.11');
