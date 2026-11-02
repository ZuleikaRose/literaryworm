-- My Library's Sort by has "Series, in reading order" (worked out in the browser, nothing stored).
-- This adds its What's new entry; src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-02'::date, '2026.11', 'feature', $lw$Sort My Library by series$lw$, $lw$My Library's Sort by has Series, in reading order: each series comes together, A to Z, with its books in order, then the books in no series by title. LiteraryWorm books use their series, and other books the one their title names, such as "(The Expanse, #1)". Uploads sort the same way.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Sort My Library by series$lw$ and c.version = '2026.11');
