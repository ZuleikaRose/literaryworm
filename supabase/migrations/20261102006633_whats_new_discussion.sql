-- Discussion questions for book clubs (the `discussion` function, chapter_discussions, 6631; the
-- policies, 6632). This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'feature', $lw$Discussion questions for book clubs$lw$, $lw$On a book club's page for a public-domain classic, Discussion questions gives five to eight questions about a chapter you've reached, written by AI from the book up to the end of that chapter only, so nothing later is given away. Choose Start a post with this to begin a post with one. Every club at that chapter gets the same questions.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Discussion questions for book clubs$lw$ and c.version = '2026.11');
