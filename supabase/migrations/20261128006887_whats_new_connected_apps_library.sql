-- What's new: connected apps that may change the library. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'feature', $lw$Let an assistant add books to your library$lw$, $lw$When you connect an AI assistant or the LiteraryWorm command line, it can now ask to add books from our catalog to your library and change a book's status, such as marking one finished. You choose: leave the new tick on when you allow it, or untick it and the app only reads. Nothing can remove a book, and Account → Sign-in shows which apps can make changes. From a terminal: npx literaryworm login --library, then add and mark.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Let an assistant add books to your library$lw$ and c.released_on = '2026-11-28');
