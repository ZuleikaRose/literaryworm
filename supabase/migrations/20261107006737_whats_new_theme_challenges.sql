-- What's new: Theme challenges for the household. src/data/changelog.json has the same.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select '2026-11-07'::date, '2026.11', 'feature', $lw$Theme challenges for the household$lw$, $lw$Goals → Start a challenge can now count Themes covered: nine prompts such as a book from before 1900, a book in another language, poetry or a true story. Each finished book ticks the themes it fits, and the challenge shows who covered which.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Theme challenges for the household$lw$ and c.released_on = '2026-11-07');
