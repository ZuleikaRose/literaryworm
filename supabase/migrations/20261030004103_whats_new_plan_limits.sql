-- What's new: plan limits (migration 4100) and favourite genres from the full list
-- (src/data/changelog.json has the same). Data only; skipped if an editor added them already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select v.released_on, v.version, v.kind, v.title, v.body, v.major
from (values
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Plan limits on listening and offline devices$lw$, $lw$Each plan's audiobook hours and offline devices now apply: Basic 5 hours a month and 1 device, Standard 30 hours and 3 devices, Premium unlimited listening and 5 devices. Account → Plan and billing shows this month's listening and lets you free a device.$lw$, true),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Favourite genres from the full list$lw$, $lw$Pick favourites from all nineteen genres when you set up or edit a profile. Up to two that aren't already on Home get a row of their own there, and more of our own titles are tagged Thriller, Historical Fiction and Fantasy.$lw$, false)
) as v(released_on, version, kind, title, body, major)
where not exists (select 1 from public.changelog_entries c where c.title = v.title and c.version = v.version);
