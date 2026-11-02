-- Starting a club: Sort by has My Library's eleven sorts for LiteraryWorm books and uploads (worked
-- out in the browser, nothing stored). This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'update', $lw$More ways to sort when starting a club$lw$, $lw$When you start a club, Sort by has the same eleven choices as My Library for LiteraryWorm books and your uploads: recently added, oldest added, recently changed, title, numbers first, author, published year and series in reading order. For LiteraryWorm books, the date sorts put the books in your library first.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More ways to sort when starting a club$lw$ and c.version = '2026.11');
