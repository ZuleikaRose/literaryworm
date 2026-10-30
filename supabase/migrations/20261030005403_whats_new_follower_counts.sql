-- What's new: see who follows an author (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$See who follows an author$lw$, $lw$Author and narrator pages now show how many readers follow them, and My Library has a new Following tab listing everyone you follow, with their pages and Unfollow.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$See who follows an author$lw$ and c.version = $lw$2026.10$lw$);
