-- What's new: content notes (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Content notes$lw$, $lw$Every LiteraryWorm title's page now has Content notes: how much violence, death, frightening scenes, language, sexual content, alcohol and drugs, prejudice, and self-harm a book has (none, mild, moderate or strong), each with a short note and no spoilers, and a line on who it suits. Grown-ups see them under a Kids profile's book requests in Account → Family too. They're written by AI from the book's details, the same for everyone, and nothing about you is sent.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Content notes$lw$ and c.version = $lw$2026.11$lw$);
