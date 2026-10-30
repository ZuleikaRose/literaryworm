-- Kids reading report (migration 4600): the Privacy Policy lists the weekly report among the emails
-- Mailgun sends, the setting among what we keep, and its one-click unsubscribe
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a monthly round-up of what's new in LiteraryWorm if you turn it on, and confirming that your account was deleted)$lw$, $lw$a monthly round-up of what's new in LiteraryWorm if you turn it on, a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, and confirming that your account was deleted)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$a monthly round-up of what's new in LiteraryWorm if you turn it on, and confirming that your account was deleted)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$weekly emails about new books from authors you follow and the monthly What's new email (off until you turn it on)$lw$, $lw$weekly emails about new books from authors you follow, the monthly What's new email and the weekly Kids reading report (both off until you turn them on)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$weekly emails about new books from authors you follow and the monthly What's new email (off until you turn it on)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and the monthly What's new email has a one-click unsubscribe link that works without signing in)$lw$, $lw$and the monthly What's new email and the weekly Kids reading report have one-click unsubscribe links that work without signing in)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$and the monthly What's new email has a one-click unsubscribe link that works without signing in)$lw$) > 0;
