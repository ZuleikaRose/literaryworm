-- What's new: the twelve genres added to Home and Search (src/data/changelog.json has the
-- same). Data only; skipped if an editor has already added it.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$update$lw$, $lw$More genres to browse and search$lw$, $lw$Alongside Technology, Adventure, Sci-Fi, Fiction, Non-Fiction and Horror, you can now browse and search Fantasy, Mystery, Thriller, Romance, Classics, Historical Fiction, Young Adult, Children's, Biography & Memoir, History, Science, Self-Help and Poetry.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$More genres to browse and search$lw$ and c.version = $lw$2026.10$lw$);
