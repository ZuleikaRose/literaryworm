-- What's new: previously…, a recap when you come back (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Previously…, a recap when you come back$lw$, $lw$Coming back to a classic audiobook? Previously… in the player (and in the mini-player's More) catches you up from the second chapter on: the story so far and what happened last time. It's written by AI from the chapters before yours only, so nothing ahead is given away.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Previously…, a recap when you come back$lw$ and c.version = $lw$2026.11$lw$);
