-- What's new: every top-level Google Books (BISAC) subject as a genre, 64 in all. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'feature', $lw$Every Google Books genre$lw$, $lw$Home and Search now have 64 genres to browse and filter by: besides Fantasy, Mystery, Romance and the rest, every subject Google Books files books under, from Antiques & Collectibles, Cooking and Comics & Graphic Novels to Philosophy, Travel and True Crime, with none repeated. On a phone, Home's genres are one row you swipe along. Kids profiles see the genres with books chosen for them.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Every Google Books genre$lw$ and c.version = '2026.11');
