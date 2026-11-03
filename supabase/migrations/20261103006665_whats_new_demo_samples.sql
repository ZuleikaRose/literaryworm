-- The demo household's samples for refer a friend, reading sprints and gift wishlists, and two catalog classics
-- tagged LGBTQIA+. This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'update', $lw$The demo shows the newest features$lw$, $lw$Try the demo now has a sample invite link in Account → Plan and billing, last night's reading sprint in Goals and on the demo club's page, and Jordan's wishlist, which opens Gifts with its five books picked. Carmilla and The Picture of Dorian Gray are now among the LGBTQIA+ books.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$The demo shows the newest features$lw$ and c.version = '2026.11');
