-- What's new: true read-along for three LibriVox classics (public/alignments). src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-04'::date, '2026.11', 'feature', $lw$Read along with the real recording$lw$, $lw$For Alice's Adventures in Wonderland, Frankenstein and Pride and Prejudice, the player's transcript now shows the book's own words while the LibriVox recording plays, each sentence marked as it's read. We lined each recording up with the text once, ahead of time; nothing about your listening is sent anywhere.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Read along with the real recording$lw$ and c.version = '2026.11');
