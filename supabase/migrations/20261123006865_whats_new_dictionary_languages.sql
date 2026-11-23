-- What's new: the dictionary in the book's own language (minor). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-23'::date, '2026.11', 'update', $lw$The dictionary looks words up in the book's own language$lw$, $lw$Choose Define in the reader, or Dictionary in the reader or the player, and the word is looked up in the language of the book you're reading: French in Madame Bovary, German in Effi Briest, Greek in Papadiamantis's stories, and any of the app's 21 languages in your own uploads, with definitions in English from Wiktionary. You can switch to English for a word. My words keeps each word with its language and shows it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$The dictionary looks words up in the book's own language$lw$ and c.released_on = '2026-11-23');
