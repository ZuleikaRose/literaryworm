-- What's new: pay yearly, two months free (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Pay yearly, two months free$lw$, $lw$Every plan can now be paid yearly, at ten times the monthly price. Choose Yearly on Plans, or switch from monthly at any time: your year starts straight away, with the unused part of the month taken off. The bell reminds you 30 days before your year renews.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Pay yearly, two months free$lw$ and c.version = $lw$2026.10$lw$);
