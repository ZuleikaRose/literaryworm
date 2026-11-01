-- What's new: audio clips (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Share a clip of an audiobook$lw$, $lw$In the player, or the mini-player's More menu, choose Share a clip to share the last 15, 30 or 60 seconds you heard of a LibriVox recording as a link. Anyone can open it and play that stretch, with the book and narrator named. The recordings are in the public domain, and nothing is recorded or uploaded: the clip page plays it straight from the Internet Archive.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Share a clip of an audiobook$lw$ and c.version = $lw$2026.11$lw$);
