-- What's new: Upload PDFs and Kindle books. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Upload PDFs and Kindle books$lw$, $lw$My Library → Uploads now takes PDFs and DRM-free Kindle books (MOBI and AZW3) as well as EPUBs. They're read on your device and kept as text, like EPUBs, so you can search them, read them anywhere, listen with any voice and read them in a club. A PDF is split into parts at its bookmarks, or every 20 pages; scanned pages have no text to read.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Upload PDFs and Kindle books$lw$ and c.released_on = '2026-11-07');
