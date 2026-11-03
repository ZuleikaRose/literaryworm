-- Refer a friend (6657-6659). This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'feature', $lw$Invite a friend, both get a month free$lw$, $lw$Share your link from Account → Plan and billing. When a friend joins with it and makes their first payment, you each get a month of your own plan free, taken off your next bill. You can earn up to 2 free months this way, and every friend you invite still gets theirs.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Invite a friend, both get a month free$lw$ and c.version = '2026.11');
