-- What's new: classics in their own language, easier to find (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$update$lw$, $lw$Classics in their own language, easier to find$lw$, $lw$Discover has a new row, In their own language, with the classics in French, German and Spanish, and Search lists them under Or read a classic in its own language. Plans and the home page now describe notifications on your devices, Previously… recaps, your time with each book and where everyone is in a club.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Classics in their own language, easier to find$lw$ and c.version = $lw$2026.11$lw$);
