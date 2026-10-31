-- What's new: book requests from Kids profiles (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-31$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Kids can ask for a book$lw$, $lw$When a book isn't on a Kids profile's shelf, the child can tap Ask a grown-up. The request shows in the grown-ups' notifications and in Account → Family, where a grown-up says yes or no with the account password. A yes opens that one book for that profile.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Kids can ask for a book$lw$ and c.version = $lw$2026.10$lw$);
