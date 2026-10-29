-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists gift_codes_plan_id_idx on public.gift_codes (plan_id);
