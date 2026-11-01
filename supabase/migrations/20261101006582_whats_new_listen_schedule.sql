-- What's new: offline listening on a schedule (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Offline listening on a schedule$lw$, $lw$On an audiobook's page, Read offline now has Listen offline on a schedule: as you listen, this device keeps the chapter you're on and the next 1, 3, 5 or 10 saved, on Wi-Fi only if you like, and can remove the ones you've finished. The next part is always there for the commute, without saving the whole book.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Offline listening on a schedule$lw$ and c.version = $lw$2026.11$lw$);
