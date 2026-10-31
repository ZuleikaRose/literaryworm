-- What's new: search by ISBN (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Search by ISBN$lw$, $lw$Search now has a third choice beside Title and Author: ISBN. Type the 10- or 13-digit number from the back of a book or its copyright page, with or without hyphens, to find that edition on Google Books. We check the number first, so a mistyped digit is caught straight away.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Search by ISBN$lw$ and c.version = $lw$2026.10$lw$);
