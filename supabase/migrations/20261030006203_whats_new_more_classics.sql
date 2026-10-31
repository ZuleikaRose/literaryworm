-- What's new: 50 more public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$50 more classics to read and hear$lw$, $lw$Emma, Great Expectations, Wuthering Heights, Huckleberry Finn, The Hound of the Baskervilles, Heidi, The War of the Worlds and 43 more classics are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to, chapter by chapter. That's 71 in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$50 more classics to read and hear$lw$ and c.version = $lw$2026.10$lw$);
