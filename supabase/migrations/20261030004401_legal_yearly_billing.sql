-- Yearly billing (migration 4400): the Terms and the Return Policy say members can pay yearly, how a
-- yearly plan renews and is cancelled, and how moving between monthly and yearly works
-- (src/data/legalPages.json has the same change). A page an editor has reworded is left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$LiteraryWorm is a live service: when you choose a plan, you're billed monthly through Stripe until you cancel.$lw$, $lw$LiteraryWorm is a live service: when you choose a plan, you're billed monthly or yearly (as you choose) through Stripe until you cancel.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$LiteraryWorm is a live service: when you choose a plan, you're billed monthly through Stripe until you cancel.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Billing and renewal. Your subscription will continue and automatically renew each month on your billing day unless canceled.$lw$, $lw$Billing and renewal. Your subscription will continue and automatically renew each month on your billing day (or, if you pay yearly, each year on the date your year started) unless canceled.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$Billing and renewal. Your subscription will continue and automatically renew each month on your billing day unless canceled.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$Plans renew automatically each month on your billing day until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds. You can change your billing day (the 1st to the 28th), and pause and resume, from Account.$lw$, $lw$Plans renew automatically each month on your billing day until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds. You can change your billing day (the 1st to the 28th), and pause and resume, from Account. Yearly plans cost ten times the monthly price, start the day you pay and renew on that date each year until you cancel; we remind you in the app 30 days before. The same 48 hours' notice applies, so cancelling later means one more yearly charge. Moving from monthly to yearly starts the year at once, with the unused part of the month taken off its price; moving a yearly plan to a bigger plan charges the difference for the rest of the year straight away, and to a smaller one takes effect at renewal with no credit. Yearly plans can't be paused, change their billing day, or move to monthly billing until the year ends.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$Plans renew automatically each month on your billing day until you cancel, which you can do online at any time; reading continues until the end of the period you've paid for. Cancel at least 48 hours before your billing date to stop the next charge; cancelling later means one more monthly charge, and then the membership ends. No refunds. You can change your billing day (the 1st to the 28th), and pause and resume, from Account.$lw$) > 0;

update public.legal_pages
set sections = replace(sections::text, $lw$You'll be billed monthly until you cancel. Add a payment method in Account → Plan and billing to continue your membership. You can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account.$lw$, $lw$You'll be billed monthly, or yearly if you choose, until you cancel. Add a payment method in Account → Plan and billing to continue your membership. On monthly billing you can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account; a yearly plan can be cancelled at any time, but not paused.$lw$)::jsonb
where slug in ($lw$terms$lw$, $lw$returns$lw$)
  and strpos(sections::text, $lw$You'll be billed monthly until you cancel. Add a payment method in Account → Plan and billing to continue your membership. You can change your billing day to any day from the 1st to the 28th, and start, pause or cancel billing at any time in Account.$lw$) > 0;
