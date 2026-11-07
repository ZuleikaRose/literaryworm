-- Premium's new price: $60.00 a month ($600.00 a year; a year is still ten months). Basic ($30.00)
-- and Standard ($40.00) are unchanged, and so are Premium's profiles, listening, offline devices and
-- natural-voice hours. src/data/plans.ts, PRICES in checkout/index.ts and index.html say the same.
--
-- In Stripe Premium's new prices take over its lookup keys (literaryworm_premium_monthly / _yearly,
-- transfer_lookup_key) and the old ones are archived: memberships already running keep the price
-- they started on. Referral credits (a month of the member's own plan) read price_cents from here.

update public.plans set price_cents = 6000, yearly_price_cents = 60000 where id = 'premium';
