-- What's new: a weekly goal for everyone (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$A weekly goal for everyone$lw$, $lw$Grown-up and teen profiles can now set their own weekly reading goal in Goals, from 1 to 5 hours a week, and see how close they are over the last 7 days. Kids profiles still have theirs set by a grown-up.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A weekly goal for everyone$lw$ and c.version = $lw$2026.10$lw$);
