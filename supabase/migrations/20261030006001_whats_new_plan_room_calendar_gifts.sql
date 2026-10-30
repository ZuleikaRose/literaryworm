-- What's new: this round's changes (src/data/changelog.json has the same).
-- Data only; each skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$A reminder before a gift starts$lw$, $lw$Bought a gift membership for a later day? We'll email you three days before it starts, so you remember to pass the code on. The email links to your gifts; the code itself stays on the Gifts page.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A reminder before a gift starts$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Meeting changes update your calendar$lw$, $lw$When a book club meeting moves or is cancelled, the email now comes with a calendar file. Open it and the meeting moves in your calendar, or comes out of it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Meeting changes update your calendar$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Kids report in groups$lw$, $lw$The Kids reading report in Account and the Monday email now group Kids profiles: still working on their goal, no reading yet, reading without a goal, and goal reached. Handy now that a household can have up to 12 profiles.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Kids report in groups$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Follower counts in author search$lw$, $lw$Searching by author now shows how many readers follow each author it finds, next to Follow.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Follower counts in author search$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Moving to a smaller plan$lw$, $lw$Before you move to a plan with fewer profiles or offline devices, Plans now says how many profiles to remove and devices to free, with links to do it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Moving to a smaller plan$lw$ and c.version = $lw$2026.10$lw$);
