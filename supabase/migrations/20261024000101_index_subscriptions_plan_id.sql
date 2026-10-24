-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists subscriptions_plan_id_idx on public.subscriptions (plan_id);
