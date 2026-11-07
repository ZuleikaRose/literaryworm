-- What's new: Character voices in every language. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'update', $lw$Character voices in every language$lw$, $lw$Character voices now find who's talking in all 20 languages natural voices read your uploads in, from Italian, Polish and Russian to Chinese, Japanese, Korean, Hindi and Arabic: each language's quotation marks, dialogue that starts with a dash, and the words that name the speaker.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Character voices in every language$lw$ and c.released_on = '2026-11-07');
