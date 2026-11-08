-- What's new: Every file type you can upload, listed. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'update', $lw$Every file type you can upload, listed$lw$, $lw$My Library → Uploads now lists every DRM-free file type you can add: EPUB, PDF (with real text), and Kindle MOBI, AZW3 and AZW, with what can't be read and how to convert an older Kindle file. The same list shows when you start a book club on an upload or choose your copy for a club, and the FAQ and Help have it too.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Every file type you can upload, listed$lw$ and c.released_on = '2026-11-08');
