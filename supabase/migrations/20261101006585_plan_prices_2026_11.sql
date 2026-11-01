-- New prices: Basic $15.00 a month ($150.00 a year), Standard $20.00 ($200.00), Premium $30.00
-- ($300.00); a year is still ten months. Standard now has room for 3 profiles (was 5); its
-- listening (30 hours) and offline devices (10) are unchanged. src/data/plans.ts, PRICES in
-- checkout/index.ts and PLAN_ROOM in _shared/stripe.ts say the same.
--
-- In Stripe each plan's new price took over its lookup key (literaryworm_<plan>_monthly / _yearly)
-- and the old prices were archived: memberships already running keep the price they started on.
--
-- Profiles: nothing is set aside here. enforce_profile_limit() and the set-aside trigger only stop
-- a household adding or bringing back a profile past the room, so a Standard household that
-- already has 4 or 5 profiles keeps them in use (the Terms say so); fit_profiles_to_plan() fits it
-- to 3 only when its plan or status next changes.

update public.plans set price_cents = 1500, yearly_price_cents = 15000 where id = 'basic';
update public.plans set price_cents = 2000, yearly_price_cents = 20000, max_profiles = 3 where id = 'standard';
update public.plans set price_cents = 3000, yearly_price_cents = 30000 where id = 'premium';
