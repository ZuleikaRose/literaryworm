-- What's new: share highlights with your book club (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Share highlights with your book club$lw$, $lw$On a club's page, Shared highlights shows the passages members marked in the book, with their notes if they chose to share them. Ones from chapters you haven't reached stay hidden until you choose to see them, like posts. Share one of your own from the list there, and stop sharing it whenever you like.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Share highlights with your book club$lw$ and c.version = $lw$2026.11$lw$);
