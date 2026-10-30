-- What's new: a weekly reading report for Kids profiles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$A weekly reading report for Kids profiles$lw$, $lw$Account → Family now shows how each Kids profile read this week: time, days read and books finished. Turn on Email me this every week to get it on Monday mornings.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A weekly reading report for Kids profiles$lw$ and c.version = $lw$2026.10$lw$);
