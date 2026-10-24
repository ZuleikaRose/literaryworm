-- Book page: every log for a volume, newest first. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists logs_volume_id_created_at_idx on public.logs (volume_id, created_at desc);
