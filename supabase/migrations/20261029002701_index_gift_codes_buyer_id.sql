-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists gift_codes_buyer_id_idx on public.gift_codes (buyer_id);
