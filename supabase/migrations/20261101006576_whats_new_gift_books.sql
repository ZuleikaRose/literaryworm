-- What's new: gift a book or a list with a membership (src/data/changelog.json has the same).
-- Data only; skipped if an editor added it already.

insert into public.changelog_entries (released_on, version, kind, title, body, major)
select $lw$2026-11-01$lw$::date, $lw$2026.11$lw$, $lw$feature$lw$, $lw$Gift a book or a list with a membership$lw$, $lw$When you buy a gift membership, you can add up to 10 LiteraryWorm books to it: find a title, or add one of your lists. They're named in the email if we send it, and waiting in the recipient's library when they redeem the gift.$lw$, true
where not exists (select 1 from public.changelog_entries c where c.title = $lw$Gift a book or a list with a membership$lw$ and c.version = $lw$2026.11$lw$);
