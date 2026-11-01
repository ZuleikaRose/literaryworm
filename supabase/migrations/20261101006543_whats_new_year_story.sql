-- What's new: your year as a story (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Your year as a story$lw$, $lw$In My Library → Stats, Play as a story walks through your year one screen at a time: your time with books, books finished, your best streak, favourites and busiest month. Each screen is sized for Instagram, Facebook and TikTok stories, to share, download or copy. It's drawn on your device; nothing is uploaded.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Your year as a story$lw$ and c.version = $lw$2026.11$lw$);
