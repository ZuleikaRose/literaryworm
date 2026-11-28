-- The foreign key's index for sign_in_alerts.user_id (6877). Run on its own, outside a transaction.
create index concurrently if not exists sign_in_alerts_user_id_idx on public.sign_in_alerts (user_id);
