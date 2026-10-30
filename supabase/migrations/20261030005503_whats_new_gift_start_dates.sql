-- What's new: give a gift that starts later (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Give a gift that starts later$lw$, $lw$When you buy a gift membership you can now choose the day it starts, up to a year ahead, so you can buy it now for a birthday. You get the code straight away, and it can be redeemed from that day.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Give a gift that starts later$lw$ and c.version = $lw$2026.10$lw$);
