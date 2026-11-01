-- What's new: moods and pace (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Moods and pace$lw$, $lw$Tag how a book felt on its page, under How did it feel?: up to three moods, such as funny, hopeful, dark or tense, and a pace (slow, medium or fast). Each profile keeps its own. My Library can show only the books with one mood, the Feel-good picks smart list gathers the cheerful ones, and the StoryGraph export carries your moods and pace.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Moods and pace$lw$ and c.version = $lw$2026.11$lw$);
