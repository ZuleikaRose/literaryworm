-- Home's reading sprint nudge, and the home page, Plans and FAQs brought up to date. This adds its What's new
-- entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'update', $lw$Home tells you when a sprint is on$lw$, $lw$When someone at home starts a reading sprint, Home shows the time left and takes you to Goals to join in. The home page, Plans and the FAQs now describe reading sprints, gift wishlists, inviting friends and the app in seven languages.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Home tells you when a sprint is on$lw$ and c.version = '2026.11');
