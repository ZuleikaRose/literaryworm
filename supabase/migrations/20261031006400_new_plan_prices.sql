-- New prices for Standard ($14.99 a month, $149.90 a year) and Premium ($24.99, $249.90); Basic is
-- unchanged. src/data/plans.ts and the checkout function's labels say the same. In Stripe each plan's
-- new price took over its lookup key (literaryworm_<plan>_monthly / _yearly) and the old prices were
-- archived: memberships already running keep the price they started on, new ones (and gifts, which
-- read the Stripe price) pay the new one.

update public.plans set price_cents = 1499, yearly_price_cents = 14990 where id = 'standard';
update public.plans set price_cents = 2499, yearly_price_cents = 24990 where id = 'premium';
