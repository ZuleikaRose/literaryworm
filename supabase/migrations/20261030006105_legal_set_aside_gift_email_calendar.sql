-- This round's policy wording (src/data/legalPages.json has the same change): the Privacy Policy
-- covers emailed gifts (what Stripe and Mailgun receive, and that the address and message are kept
-- only until the email goes), profiles set aside and club calendar links; the Terms say profiles
-- can be set aside to fit a smaller plan; the Return Policy says how emailed gifts arrive. A page an
-- editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), and confirming$lw$, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), a gift membership a member asked us to email to you (its code, plan and months, the buyer's display name and any message they wrote), and confirming$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$, a reminder three days before a gift membership you bought for a later day starts (its plan, months and start day; never the code), and confirming$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(and, for a gift that starts on a later day, when we reminded the buyer); only the buyer can see the code$lw$, $lw$(and, for a gift that starts on a later day, when we reminded the buyer). If you ask us to email a gift to someone, Stripe receives their email address and your message with the payment, and we keep both only until the email has gone; only the buyer can see the code$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$(and, for a gift that starts on a later day, when we reminded the buyer); only the buyer can see the code$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal and player settings.$lw$, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal and player settings, and whether it's set aside.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$each profile's name, avatar, age rating, favourite genres, daily limit, weekly goal and player settings.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$such as reading logs, book clubs and shared lists.$lw$, $lw$such as reading logs, book clubs and shared lists. A book club's calendar link lets your calendar app read the club's meetings (their names, times and notes) from us; the link is yours, we don't store it, and it stops working if you leave the club.$lw$)::jsonb
where slug in ($lw$privacy$lw$)
  and strpos(sections::text, $lw$such as reading logs, book clubs and shared lists.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$first remove the profiles and free the devices it has no room for.$lw$, $lw$first set aside or remove the profiles and free the devices it has no room for. A profile set aside keeps its shelf, history and settings, doesn't count towards the plan, and comes back when there's room. While a yearly membership waits to move to a smaller plan at renewal, it has that plan's room already.$lw$)::jsonb
where slug in ($lw$terms$lw$)
  and strpos(sections::text, $lw$first remove the profiles and free the devices it has no room for.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; we email the buyer three days before)$lw$, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; if the buyer asked us to email it to the person it's for, we send it once it can be redeemed, and otherwise we remind the buyer three days before a later start)$lw$)::jsonb
where slug in ($lw$returns$lw$)
  and strpos(sections::text, $lw$(from the day the gift starts, if the buyer chose a later day up to a year ahead; we email the buyer three days before)$lw$) > 0;
