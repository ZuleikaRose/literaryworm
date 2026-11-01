-- What's new: book clubs on uploaded books (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Book clubs on books you uploaded$lw$, $lw$Start a book club around a book you uploaded, such as a DRM-free EPUB you bought: choose My uploads when you start one, and search by title or author to find it. Your file stays private. The club sees the title and author, and each member uploads their own copy and chooses it on the club's page, so the discussion, where everyone is and shared highlights follow their place in it without spoilers.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Book clubs on books you uploaded$lw$ and c.version = $lw$2026.11$lw$);
