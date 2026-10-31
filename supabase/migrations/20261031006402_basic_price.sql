-- Basic goes to $9.99 a month ($99.90 a year). src/data/plans.ts and the checkout function's labels
-- say the same; in Stripe the new prices took over literaryworm_basic_monthly / _yearly and the old
-- ones were archived (no active subscription was on them).

update public.plans set price_cents = 999, yearly_price_cents = 9990 where id = 'basic';
