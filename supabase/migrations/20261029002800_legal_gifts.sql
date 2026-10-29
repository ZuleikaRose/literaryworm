-- Gift memberships: the Privacy Policy says what's kept about a gift and who sees
-- its code, and the Return Policy says gifts are final, don't expire and what
-- happens when the free months end (src/data/legalPages.json has the same change).
-- The edit trigger keeps the old versions; a page an editor has reworded since is
-- left as it is.

update public.legal_pages
set sections = replace(sections::text, $lw$Stripe's ids for your customer record and subscription, and whether each payment succeeded.$lw$, $lw$Stripe's ids for your customer record and subscription, and whether each payment succeeded. If you buy a gift membership, we keep its code, plan, number of months and price, and whether and when it was redeemed; only the buyer can see the code, and we record which account redeemed it.$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%Stripe's ids for your customer record and subscription, and whether each payment succeeded.%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$payment history (amounts, dates and whether each payment succeeded), with Stripe's ids$lw$, $lw$payment history (amounts, dates and whether each payment succeeded), gift memberships you bought or redeemed (plan, months, price and when redeemed), with Stripe's ids$lw$)::jsonb
where slug = 'privacy'
  and sections::text like $lw$%payment history (amounts, dates and whether each payment succeeded), with Stripe's ids%$lw$;

update public.legal_pages
set sections = replace(sections::text, $lw$which stops billing until you resume."$lw$, $lw$which stops billing until you resume.", "Gift memberships are paid once and are final too. A gift code doesn't expire, works once, and can't be exchanged for cash or refunded. Redeeming one gives its months free on the gift's plan; when they end, the membership ends unless a card has been added, and then it renews monthly until you cancel."$lw$)::jsonb
where slug = 'returns'
  and sections::text like $lw$%which stops billing until you resume."%$lw$;
