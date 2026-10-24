-- Bookmarks' foreign key to library_items, and the reader's "bookmarks in this book" list. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists bookmarks_user_id_volume_id_idx on public.bookmarks (user_id, volume_id);
