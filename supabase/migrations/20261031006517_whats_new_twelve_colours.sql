-- What's new: twelve highlight colours (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Twelve highlight colours$lw$, $lw$Highlights now come in twelve colours: lime, indigo, brown and grey join yellow, green, blue, pink, orange, purple, teal and red. Pick one when you highlight, or change a highlight's colour in Notes and highlights.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Twelve highlight colours$lw$ and c.version = $lw$2026.10$lw$);
