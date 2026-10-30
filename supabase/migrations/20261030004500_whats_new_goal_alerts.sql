-- What's new: goals and streaks in the bell (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Goals and streaks in the bell$lw$, $lw$The bell now tells you when a streak of three days or more ends tonight (from 6 pm, until you read), when you're one or two books from this year's goal, and when you reach it.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Goals and streaks in the bell$lw$ and c.version = $lw$2026.10$lw$);
