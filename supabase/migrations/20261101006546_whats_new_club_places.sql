-- What's new: see where your club is (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$See where your club is$lw$, $lw$A book club's page now shows where everyone is in the book: each member's chapter and how far through they are, for members who turn on Show my place to this club. It's off until you choose, it shows nothing else about your reading, and posts past your chapter stay hidden as before.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$See where your club is$lw$ and c.version = $lw$2026.11$lw$);
