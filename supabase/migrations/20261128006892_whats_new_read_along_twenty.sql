-- What's new: five more classics with a true read-along. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-28'::date, '2026.11', 'feature', $lw$Read along with five more classics$lw$, $lw$The read-along now shows the book's own words, marked as the LibriVox reader says them, for The Hound of the Baskervilles, A Study in Scarlet, The Wind in the Willows, A Little Princess and Anne of Green Gables: twenty classics in all. Turn on Read-along in the player.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Read along with five more classics$lw$ and c.released_on = '2026-11-28');
