-- What's new: change a club meeting's time (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Change a club meeting's time$lw$, $lw$Club owners can now change a meeting's time, length, name or note, instead of cancelling it and adding a new one. When a meeting moves or is cancelled, everyone in the club gets an email with the old and new times, unless they turned meeting emails off.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Change a club meeting's time$lw$ and c.version = $lw$2026.10$lw$);
