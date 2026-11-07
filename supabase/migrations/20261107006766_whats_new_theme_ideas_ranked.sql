-- What's new: Theme ideas picked for you. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$Theme ideas picked for you$lw$, $lw$The book ideas on Discover for a themes challenge now come in your order: books like the ones you loved and finished, by authors and narrators you follow, and in the moods you tag most come first.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Theme ideas picked for you$lw$ and c.released_on = '2026-11-07');
