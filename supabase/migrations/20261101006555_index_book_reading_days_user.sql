-- book_reading_days.user_id, for RLS (migration 6554). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists book_reading_days_user_id_idx on public.book_reading_days (user_id);
