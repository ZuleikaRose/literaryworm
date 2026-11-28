-- What's new: more to try in the demo. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'update', $lw$More to try in the demo$lw$, $lw$The demo now has the voices that run on your device (all 39, free and offline after one download), a language for emails and log-in emails in Preferences, and a second connected app: the LiteraryWorm command line, allowed to add books and change their status.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More to try in the demo$lw$ and c.released_on = '2026-11-28');
