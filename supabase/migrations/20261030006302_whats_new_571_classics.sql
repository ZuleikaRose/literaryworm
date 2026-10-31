-- What's new: a third 250 public-domain titles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$250 more classics: 571 to read and hear$lw$, $lw$Trollope's Palliser and Barsetshire novels, more Scott, Hardy, Collins and Dumas, The Maltese Falcon, The Sun Also Rises, Kim, The Woman in White, Tom Swift, the Bobbsey Twins, more Tarzan, Wodehouse and 230 others are now in LiteraryWorm, each with the whole book to read and a LibriVox recording to listen to. That's 571 classics in all.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$250 more classics: 571 to read and hear$lw$ and c.version = $lw$2026.10$lw$);
