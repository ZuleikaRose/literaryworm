-- What's new: voice control in car mode in every interface language. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'update', $lw$Voice control in your language$lw$, $lw$Voice control in car mode now listens in the language you've chosen for LiteraryWorm, in all 21 of them: say play, pause, back 30 or next chapter in Spanish, Japanese, Greek or any of the others. The voice control dialog shows the words to use.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Voice control in your language$lw$ and c.released_on = '2026-11-28');
