-- What's new: 300 more public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$300 more classics: 871 to read and hear$lw$, $lw$Ulysses, The Divine Comedy, Paradise Lost, Beowulf, Leaves of Grass, Pinocchio, The Blue Fairy Book, Rob Roy, Grant's memoirs, Two Years Before the Mast, The King in Yellow, Arsène Lupin, Dr Thorndyke, Henty's and Altsheler's adventures and 280 others are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to. That's 871 classics in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$300 more classics: 871 to read and hear$lw$ and c.version = $lw$2026.10$lw$);
