-- What's new: moving up a plan from the limit screens (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Move up a plan in one tap$lw$, $lw$When this month's listening or your offline devices run out, the message offers the next plan up and opens its checkout straight away.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Move up a plan in one tap$lw$ and c.version = $lw$2026.10$lw$);
