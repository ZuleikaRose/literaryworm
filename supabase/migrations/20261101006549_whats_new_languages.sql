-- What's new: classics in french, german and spanish (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Classics in French, German and Spanish$lw$, $lw$Six classics to read and hear in their own language: Voltaire's Candide and Flaubert's Madame Bovary in French, Fontane's Effi Briest and Busch's Max und Moritz in German, and Pérez Galdós's Marianela and Lazarillo de Tormes in Spanish. Each has the full text and a LibriVox recording in that language. Find them with Search's language filter.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Classics in French, German and Spanish$lw$ and c.version = $lw$2026.11$lw$);
