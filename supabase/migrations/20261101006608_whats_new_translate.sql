-- What's new: translate a passage (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Translate a passage$lw$, $lw$In the classics, select some words and choose Translate to read them in English, French, German, Spanish, Italian, Portuguese or Dutch. It's handy for the French, German and Spanish classics, and works in every public-domain title. The translation is written by AI, and only the words you selected are sent. Not on Kids profiles.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Translate a passage$lw$ and c.version = $lw$2026.11$lw$);
