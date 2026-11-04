-- What's new: the age check for books marked mature (6684). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'feature', $lw$An age check for books marked mature$lw$, $lw$Before a grown-up's profile, or a visitor, opens a book that Google Books or Open Library marks as mature, LiteraryWorm now asks you to confirm you're 18 or older. A profile is asked once, on every device; a visitor once a visit. Kids and Teen profiles still can't open these books at all.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$An age check for books marked mature$lw$ and c.version = '2026.11');
