-- What's new: sorting and filtering books when starting a club (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$Sort and filter books when starting a club$lw$, $lw$When you start a book club, the Book list can be sorted by title (A–Z or Z–A), author, numbers first or series in reading order, and filtered to one series or to books in none. It works for LiteraryWorm titles and for your uploaded DRM-free EPUBs, including ones you bought; an upload's series comes from its title, such as "(The Expanse, #1)".$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Sort and filter books when starting a club$lw$ and c.version = $lw$2026.11$lw$);
