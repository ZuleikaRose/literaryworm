-- The foreign key on push_subscriptions.user_id (migration 6535). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
