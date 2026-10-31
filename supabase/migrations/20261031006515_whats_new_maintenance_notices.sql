-- What's new: notices before planned updates (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Notices before planned updates$lw$, $lw$When we plan an update that might log you out or slow things down for a moment, a notice across the top of every page says when, in your own time zone. Hide it with the cross; it goes by itself when the work is done.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Notices before planned updates$lw$ and c.version = $lw$2026.10$lw$);
