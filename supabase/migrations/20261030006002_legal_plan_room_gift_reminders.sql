-- This round's policy wording (src/data/legalPages.json has the same change): the Privacy Policy's
-- Mailgun list gains the meeting calendar file and the gift start reminder, and the gift data line the
-- reminder; the Return Policy says the buyer is reminded; the Terms say how to move down a plan. A page
-- an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note)$lw$, $lw$a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note, with the meeting as a calendar file)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$a note when one of its meetings moves or is cancelled (the club's name and book and the meeting's name, times and note)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$, and confirming that your account was deleted)$lw$, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), and confirming that your account was deleted)$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$, and confirming that your account was deleted)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and whether and when it was redeemed; only the buyer$lw$, $lw$and whether and when it was redeemed (and, for a gift that starts on a later day, when we reminded the buyer); only the buyer$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$and whether and when it was redeemed; only the buyer$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead)$lw$, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; we email the buyer three days before)$lw$)::jsonb
where slug in ($lw$returns$lw$)
  and strpos(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead)$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$and you can change plan at any time.$lw$, $lw$and you can change plan at any time. To move to a plan with fewer profiles or offline devices, first remove the profiles and free the devices it has no room for.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$and you can change plan at any time.$lw$) > 0;
