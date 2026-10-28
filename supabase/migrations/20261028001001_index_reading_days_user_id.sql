-- RLS on reading_days filters on user_id; the app loads an account's days by it.
create index concurrently if not exists reading_days_user_id_idx on public.reading_days (user_id);
