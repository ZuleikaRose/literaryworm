-- What's new: review your highlights (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Review your highlights$lw$, $lw$My Library → Notes now has Review for your highlights: each passage you marked comes back the day after, then after 1, 3, 7, 14, 30 and 60 days while it still matters, with your note and a link to the page. Up to 10 a day, and Home tells you when some are due.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Review your highlights$lw$ and c.version = $lw$2026.11$lw$);
