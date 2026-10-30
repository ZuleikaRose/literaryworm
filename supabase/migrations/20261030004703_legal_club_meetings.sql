-- Book club calendar (migration 4700): the Privacy Policy lists meeting reminders among the emails
-- Mailgun sends, the setting among what we keep, and its one-click unsubscribe
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, and confirming that your account was deleted)$lw$, $lw$a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, a reminder the day before a book club you're in meets (the club's name and book and the meeting's name, time and note), and confirming that your account was deleted)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$a weekly report of how your Kids profiles read (their names, reading and listening time, days read and books finished) if you turn it on, and confirming that your account was deleted)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$the monthly What's new email and the weekly Kids reading report (both off until you turn them on)$lw$, $lw$the monthly What's new email and the weekly Kids reading report (both off until you turn them on), book club meeting reminders (on until you turn them off)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$the monthly What's new email and the weekly Kids reading report (both off until you turn them on)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and the monthly What's new email and the weekly Kids reading report have one-click unsubscribe links that work without signing in)$lw$, $lw$and the monthly What's new email, the weekly Kids reading report and book club meeting reminders have one-click unsubscribe links that work without signing in)$lw$)::jsonb
where slug = $lw$privacy$lw$
  and strpos(sections::text, $lw$and the monthly What's new email and the weekly Kids reading report have one-click unsubscribe links that work without signing in)$lw$) > 0;
