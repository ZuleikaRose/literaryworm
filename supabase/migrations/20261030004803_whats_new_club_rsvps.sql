-- What's new: club meeting RSVPs (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Who's coming to club meetings$lw$, $lw$Book club meetings now ask everyone whether they're coming: Going, Maybe or Can't make it, with who's going shown on the club page. Meetings in the next day show up in the notification bell, and if you can't make one we won't send you the reminder.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Who's coming to club meetings$lw$ and c.version = $lw$2026.10$lw$);
