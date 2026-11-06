-- What's new: natural voices (Google Cloud Text-to-Speech) for members' uploads. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-06'::date, '2026.11', 'feature', $lw$Natural voices for your uploads$lw$, $lw$Members can now have their uploaded books read aloud by a natural-sounding voice from Google: in the player, open Voice and choose one of six natural voices, British, American or Australian. Each part of the book is voiced the first time you play it and kept with your upload, so listening again is free. Each plan includes some new natural-voice reading a month (Basic 2 hours, Standard 6, Premium 12). Not on Kids profiles.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Natural voices for your uploads$lw$ and c.version = '2026.11');
