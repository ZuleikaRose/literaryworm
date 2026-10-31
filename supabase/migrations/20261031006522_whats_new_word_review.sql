-- What's new: review for My words (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Review your words$lw$, $lw$My words now asks each word again just before you'd forget it: after 1, 3, 7, 14, 30 and 60 days while you know it, and tomorrow when you don't. Home says when words are due, and Review in My words goes through them.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Review your words$lw$ and c.version = $lw$2026.10$lw$);
