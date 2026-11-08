-- What's new: Greek, for the app and natural voices. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-08'::date, '2026.11', 'feature', $lw$Greek, for the app and natural voices$lw$, $lw$Choose Ελληνικά in the accessibility menu to see LiteraryWorm in Greek, the 21st language. Natural voices now read Greek books you upload too, with two Greek voices and character voices that find who's speaking, articles and all.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Greek, for the app and natural voices$lw$ and c.released_on = '2026-11-08');
