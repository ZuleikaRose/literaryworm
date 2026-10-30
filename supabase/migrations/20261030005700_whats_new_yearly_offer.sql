-- What's new: switch to yearly from the bell (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Switch to yearly from the bell$lw$, $lw$Paying monthly for nearly a year? The bell now shows what paying yearly would save on your plan, with a link to switch.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Switch to yearly from the bell$lw$ and c.version = $lw$2026.10$lw$);
