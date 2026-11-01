-- What's new: the family shelf (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$The family shelf$lw$, $lw$Grown-up and teen profiles can put a book on the family shelf from its page, and it shows on Home for everyone at home. Kids profiles see the books on it that their rating allows, so a shelf of bedtime stories or holiday reading is one place for the whole household.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$The family shelf$lw$ and c.version = $lw$2026.11$lw$);
