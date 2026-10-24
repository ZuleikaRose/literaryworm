-- Highlights' foreign key to library_items, and the reader's "highlights in this book" list. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists highlights_user_id_volume_id_idx on public.highlights (user_id, volume_id);
