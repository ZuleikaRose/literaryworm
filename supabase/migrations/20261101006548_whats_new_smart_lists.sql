-- What's new: smart lists (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Smart lists$lw$, $lw$My Library has Smart lists that fill themselves: Almost there for books you're past halfway through, Waiting for you for books you started and haven't opened in a month, From authors you follow, and Loved it. They change as you read; there's nothing to keep up.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Smart lists$lw$ and c.version = $lw$2026.11$lw$);
