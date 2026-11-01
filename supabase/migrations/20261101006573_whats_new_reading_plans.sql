-- What's new: reading plans: finish by a date (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Reading plans: finish by a date$lw$, $lw$On any book's page, choose a day to finish it by. Reading plan works out about how many minutes (at your own pace) or pages a day get you there, and tells you whether you're on track, ahead or behind. Home lists your plans with the days left. Change the date or remove a plan any time.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Reading plans: finish by a date$lw$ and c.version = $lw$2026.11$lw$);
