-- What's new: Didn't finish and rereads (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Didn't finish, and reading a book again$lw$, $lw$Your library has a fourth status, Didn't finish, for books you put down; it has its own tab in My Library, and recommendations stop pushing books like it. A finished book now has Read again on its page: it goes back to Reading from the start, and finishing it again counts as another read, so the page says "Your 2nd read" or "Read twice". Exports for Goodreads and StoryGraph carry both, and imports read StoryGraph's did-not-finish.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Didn't finish, and reading a book again$lw$ and c.version = $lw$2026.11$lw$);
