-- What's new: better search results (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$Better search results$lw$, $lw$LiteraryWorm now tells search engines more, and more accurately: each LiteraryWorm title's page describes the book, its ebook and its LibriVox audiobook; Plans and the home page describe the membership, each plan's monthly and yearly price, and the questions about plans; and every page names LiteraryWorm, its support address and its search.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Better search results$lw$ and c.version = $lw$2026.11$lw$);
