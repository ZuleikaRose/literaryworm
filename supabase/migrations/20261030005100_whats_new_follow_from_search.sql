-- What's new: follow authors from an author search (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$Follow authors from search$lw$, $lw$Searching by author now lists the authors it finds above the books, with how many of the results are theirs and a Follow button, so you can follow someone without opening their page.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Follow authors from search$lw$ and c.version = $lw$2026.10$lw$);
