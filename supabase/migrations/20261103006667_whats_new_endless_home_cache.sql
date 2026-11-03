-- Members' Home keeps scrolling through every genre, visitors see a sample, OpenDyslexic in the accessibility
-- menu (which now scrolls), and Google Books answers kept in Supabase (6666). These are their What's new entries;
-- src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'feature', $lw$Keep scrolling on Home, and OpenDyslexic for the whole app$lw$, $lw$Keep discovering on Home no longer stops at the end of a genre: it runs on into the next one, through every genre, for as long as you scroll. Visitors to the public home page see a sample of books first, then can log in, join or try the demo to keep going. The accessibility menu has a new OpenDyslexic switch that sets the whole app in OpenDyslexic (choosing it turns Lexend off, and the other way round), and the menu now scrolls inside the window, so its last settings are never cut off on a smaller screen.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Keep scrolling on Home, and OpenDyslexic for the whole app$lw$ and c.version = '2026.11');

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-03'::date, '2026.11', 'update', $lw$Books load faster, from our own copy$lw$, $lw$When Google Books tells us about a book or a list, we now keep the answer, cover link included. A book's details are asked for once and kept until another edition of it appears; lists are checked again once a week, which is how new editions are found. If Google Books is having trouble, you see last week's list instead of an error. Nothing about you is kept with them.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Books load faster, from our own copy$lw$ and c.version = '2026.11');
