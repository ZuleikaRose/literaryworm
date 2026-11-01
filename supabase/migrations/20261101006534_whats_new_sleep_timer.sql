-- What's new: a gentler sleep timer (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$A gentler sleep timer$lw$, $lw$A sleep timer set for minutes now fades the narrator out over its last 30 seconds instead of stopping mid-sentence. When it pauses the book, 15 more minutes is one tap away in the player and the mini-player, and pressing play again starts 30 seconds earlier, in case you were drifting off.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$A gentler sleep timer$lw$ and c.version = $lw$2026.11$lw$);
