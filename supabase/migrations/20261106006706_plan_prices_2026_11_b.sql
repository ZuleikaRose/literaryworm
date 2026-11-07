-- New prices: Basic $30.00 a month ($300.00 a year), Standard $40.00 ($400.00), Premium $50.00
-- ($500.00); a year is still ten months. Profiles, listening, offline devices and natural-voice hours
-- are unchanged. src/data/plans.ts, PRICES in checkout/index.ts and index.html say the same.
--
-- In Stripe each plan's new price takes over its lookup key (literaryworm_<plan>_monthly / _yearly,
-- transfer_lookup_key) and the old prices are archived: memberships already running keep the price
-- they started on. Referral credits (a month of the member's own plan) read price_cents from here.

update public.plans set price_cents = 3000, yearly_price_cents = 30000 where id = 'basic';
update public.plans set price_cents = 4000, yearly_price_cents = 40000 where id = 'standard';
update public.plans set price_cents = 5000, yearly_price_cents = 50000 where id = 'premium';
