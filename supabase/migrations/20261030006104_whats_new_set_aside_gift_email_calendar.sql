-- What's new: this round's changes (src/data/changelog.json has the same).
-- Data only; each skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Set a profile aside$lw$, $lw$Moving to a smaller plan? Instead of deleting a profile, set it aside in Who's reading?: it keeps its shelf, history and settings and doesn't count towards the plan. Bring it back when there's room, or it comes back by itself when you move up a plan.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Set a profile aside$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Email a gift to someone$lw$, $lw$When you buy a gift membership you can now have us email the code to the person it's for, with a short message from you. A gift that starts now arrives within the hour; one for a later day arrives that morning. We forget their address once it's sent.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Email a gift to someone$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Club meetings in your calendar app$lw$, $lw$Each book club now has a calendar link for its members. Add it to Google Calendar, Apple Calendar or Outlook once, and new, moved and cancelled meetings update by themselves.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Club meetings in your calendar app$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$feature$lw$, $lw$Most-followed authors on Home$lw$, $lw$Home now shows the authors readers on LiteraryWorm follow most, with how many follow each. Follow one straight from the row.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Most-followed authors on Home$lw$ and c.version = $lw$2026.10$lw$);

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-10-30$lw$::date, $lw$2026.10$lw$, $lw$fix$lw$, $lw$Plan limits when moving to monthly at renewal$lw$, $lw$A yearly membership set to move to a smaller monthly plan at renewal now has that plan's room for profiles and offline devices straight away, so nothing needs removing on renewal day.$lw$, false
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Plan limits when moving to monthly at renewal$lw$ and c.version = $lw$2026.10$lw$);
