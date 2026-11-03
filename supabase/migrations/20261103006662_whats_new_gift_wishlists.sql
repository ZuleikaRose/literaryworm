-- Gift wishlists (6661). This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'feature', $lw$Gift wishlists$lw$, $lw$Every list you share by link is now a wishlist too. Its page has Give this list as a gift, which opens Gifts with up to 10 of its LiteraryWorm books already picked, so family and friends can give you a membership that comes with the books you want.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Gift wishlists$lw$ and c.version = '2026.11');
