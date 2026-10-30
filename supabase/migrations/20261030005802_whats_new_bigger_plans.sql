-- What's new: more profiles and offline devices on Standard and Premium (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$More profiles and offline devices$lw$, $lw$Standard now has 5 profiles and Read offline on 10 devices (was 3 and 3), and Premium 12 profiles and 24 devices (was 5 and 5), at the same prices. Basic is unchanged.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More profiles and offline devices$lw$ and c.version = $lw$2026.10$lw$);
