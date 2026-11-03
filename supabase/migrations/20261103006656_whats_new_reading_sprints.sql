-- Reading sprints (6649-6655). This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'feature', $lw$Reading sprints$lw$, $lw$Start a 15 to 30 minute reading sprint from Goals for everyone at home, or from a book club's page for its members. Everyone sees the same timer, the reader shows the time left and your pages as you go, and when it ends you see how many pages each of you turned. Kids profiles can join sprints at home.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Reading sprints$lw$ and c.version = '2026.11');
