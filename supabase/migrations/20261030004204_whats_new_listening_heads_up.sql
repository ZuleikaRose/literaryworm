-- What's new: the listening heads-up and the notification label fix (src/data/changelog.json
-- has the same). Data only; skipped if an editor added them already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select v.released_on, v.version, v.kind, v.title, v.body, v.major
from (values
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$A heads-up before your listening runs out$lw$, $lw$On Basic and Standard, the player shows how much of this month's listening is left, and the bell lets you know once the household has used most of it.$lw$, false),
  ($lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$The New label in notifications$lw$, $lw$The New label on a notification now sits next to its title instead of stretching across the panel.$lw$, false)
) as v(released_on, version, kind, title, body, major)
where not exists (select 1 from public.changelog_entries c where c.title = v.title and c.version = v.version);
