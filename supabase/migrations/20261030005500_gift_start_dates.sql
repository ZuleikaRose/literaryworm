-- A gift can be bought now to start later (for a birthday, say): its code can't be redeemed
-- before starts_on. Set by the stripe-webhook function from the Checkout Session's metadata, which
-- the checkout function checked (today to a year ahead); manage-account refuses the code until
-- that day has started anywhere. Null: from the day it was bought.

alter table public.gift_codes
  add column starts_on date check (starts_on is null or starts_on <= (created_at at time zone 'UTC')::date + 367);

grant select (starts_on) on public.gift_codes to authenticated;
