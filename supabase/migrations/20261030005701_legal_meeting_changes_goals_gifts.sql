-- Meeting change emails, weekly goals for every profile, follower counts and gift start days
-- (migrations 5300 to 5600): the Privacy Policy lists the new email and what's kept, and the
-- Return Policy says when a gift code works (src/data/legalPages.json has the same change). A page
-- an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a reminder the day before a book club you're in meets (the club's name and book and the meeting's name, time and note),$lw$, $lw$a reminder the day before a book club you're in meets, and a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note),$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$a reminder the day before a book club you're in meets (the club's name and book and the meeting's name, time and note),$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$the weekly Kids reading report and book club meeting reminders have one-click unsubscribe links$lw$, $lw$the weekly Kids reading report and book club meeting emails have one-click unsubscribe links$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$the weekly Kids reading report and book club meeting reminders have one-click unsubscribe links$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$book club meeting reminders (on until you turn them off)$lw$, $lw$book club meeting emails (reminders, and when a meeting moves or is cancelled; on until you turn them off)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$book club meeting reminders (on until you turn them off)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$daily limit, weekly goal (Kids profiles) and player settings.$lw$, $lw$daily limit, weekly goal and player settings.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$daily limit, weekly goal (Kids profiles) and player settings.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$the authors and narrators you follow (and, for 60 days,$lw$, $lw$the authors and narrators you follow (their pages show how many readers follow them, never who; and, for 60 days,$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$the authors and narrators you follow (and, for 60 days,$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$A gift code doesn't expire, works once, and can't be exchanged$lw$, $lw$A gift code doesn't expire, works once (from the day the gift starts, if the buyer chose a later day up to a year ahead), and can't be exchanged$lw$)::jsonb
where slug in ($lw$returns$lw$)
  and strpos(sections::text, $lw$A gift code doesn't expire, works once, and can't be exchanged$lw$) > 0;
