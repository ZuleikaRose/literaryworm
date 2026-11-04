-- What's new: Open Library on adult profiles' Home (books function). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'feature', $lw$More books on Home, from Open Library$lw$, $lw$On a grown-up's profile, Home's genre rows and Keep discovering now come from Open Library, the free catalogue run by the Internet Archive, with Google Books stepping in when it has nothing. You'll see different books and editions, with Details from Open Library on their pages. Teen profiles, search and the public home page still use Google Books.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More books on Home, from Open Library$lw$ and c.version = '2026.11');
