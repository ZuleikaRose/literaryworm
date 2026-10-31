-- What's new: 250 more public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$250 more classics: 321 to read and hear$lw$, $lw$Middlemarch, David Copperfield, The Three Musketeers, Crime and Punishment, Anne of Avonlea, Tarzan of the Apes, ten more Oz books, Wodehouse, Woolf and 240 others are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to. That's 321 classics in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$250 more classics: 321 to read and hear$lw$ and c.version = $lw$2026.10$lw$);
