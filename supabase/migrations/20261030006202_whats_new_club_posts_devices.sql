-- What's new: this round's changes (src/data/changelog.json has the same).
-- Data only; each skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Book club posts by email$lw$, $lw$Turn on Email me new book club posts in Account → Preferences and we'll send one email a day when there's something new in your clubs: which chapters, how many posts and who wrote them. Only chapters you've reached, so no spoilers; the posts themselves stay in the app.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Book club posts by email$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$One device per browser$lw$, $lw$Listen on another device no longer lists the same browser twice after a refresh or in a second tab. Each browser you're signed in on is one device, and it's forgotten when you sign out.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$One device per browser$lw$ and c.version = $lw$2026.10$lw$);
