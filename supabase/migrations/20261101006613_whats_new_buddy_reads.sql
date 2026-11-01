-- What's new: buddy reads (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Buddy reads$lw$, $lw$Read a book with one friend: choose Read with a friend on any LiteraryWorm title's page and a buddy read starts straight away, with an invite code to send them. It's a book club for two, with spoiler-safe posts by chapter, meetings, shared highlights and where you each are, and it takes your friend and no one else.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Buddy reads$lw$ and c.version = $lw$2026.11$lw$);
