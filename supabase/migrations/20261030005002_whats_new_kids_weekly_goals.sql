-- What's new: weekly goals for Kids profiles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Weekly reading goals for Kids profiles$lw$, $lw$Grown-ups can now give a Kids profile a weekly reading goal, from 1 to 5 hours, in the profile's settings. Kids see how close they are in Goals, grown-ups see it in Account → Family, and the Monday Kids reading report says whether the goal was reached.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Weekly reading goals for Kids profiles$lw$ and c.version = $lw$2026.10$lw$);
