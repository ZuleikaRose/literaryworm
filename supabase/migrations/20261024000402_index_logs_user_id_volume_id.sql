-- Composite foreign key to library_items and the user's own logs (RLS). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists logs_user_id_volume_id_idx on public.logs (user_id, volume_id);
