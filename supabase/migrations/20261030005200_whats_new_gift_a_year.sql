-- What's new: a year's gift at the yearly price (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Gift a year for the yearly price$lw$, $lw$A year's gift membership now costs the yearly price, so it comes with two months free, just like paying yearly. Gifts of 1, 3 or 6 months are still the monthly price for each month.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Gift a year for the yearly price$lw$ and c.version = $lw$2026.10$lw$);
