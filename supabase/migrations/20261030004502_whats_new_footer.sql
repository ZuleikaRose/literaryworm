-- What's new: a tidier footer (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$A tidier footer$lw$, $lw$The links at the foot of every page are now grouped under Explore, Help, Your privacy and Legal.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A tidier footer$lw$ and c.version = $lw$2026.10$lw$);
