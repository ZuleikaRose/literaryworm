-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists gift_codes_redeemed_by_idx on public.gift_codes (redeemed_by);
