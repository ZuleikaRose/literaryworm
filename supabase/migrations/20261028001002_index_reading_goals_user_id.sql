-- RLS on reading_goals filters on user_id; the app loads an account's goals by it.
create index concurrently if not exists reading_goals_user_id_idx on public.reading_goals (user_id);
