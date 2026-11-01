-- What's new: Feel-good picks on Discover and moods on Search, and Help saying so
-- (src/data/changelog.json and src/data/legalPages.json have the same). Data only; the What's new row
-- is skipped if an editor added it already, and Help changes only where it's still the built-in wording.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$Feel-good picks on Discover, and moods on Search$lw$, $lw$Discover now has a Feel-good picks row of the books you tagged funny, hopeful, lighthearted, relaxing or inspiring, to read again. Search lists the moods you've used, each opening those books in My Library, and reminds you that Translate works in any classic.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Feel-good picks on Discover, and moods on Search$lw$ and c.version = $lw$2026.11$lw$);

update public.legal_pages set sections = replace(sections::text, $lw$My Library can show the books with one mood, and the Feel-good picks smart list gathers the cheerful ones.$lw$, $lw$My Library can show the books with one mood, Search lists the moods you've used, and Feel-good picks, a smart list and a row on Discover, gathers the cheerful ones.$lw$)::jsonb, updated_at = now()
where slug = $lw$help$lw$ and strpos(sections::text, $lw$My Library can show the books with one mood, and the Feel-good picks smart list gathers the cheerful ones.$lw$) > 0;
