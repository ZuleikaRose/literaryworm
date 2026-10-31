-- What's new: book rows keep loading when Google turns a key away (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$Book rows keep loading$lw$, $lw$When Google Books turns our requests away for a while, LiteraryWorm now asks again another way, so the rows on Home, Search, the genre pages and author pages keep filling instead of saying they couldn't load.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Book rows keep loading$lw$ and c.version = $lw$2026.10$lw$);
