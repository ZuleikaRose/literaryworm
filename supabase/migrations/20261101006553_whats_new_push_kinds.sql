-- What's new: more notifications, your choice (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$More notifications, your choice$lw$, $lw$Notifications on your devices can now also tell you about a club meeting coming up, new posts in your clubs (only up to your chapter), an evening nudge to keep a reading streak, and a grown-up's answer to a Kids book request. Choose which in Account → Preferences, under Notifications on this device.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More notifications, your choice$lw$ and c.version = $lw$2026.11$lw$);
