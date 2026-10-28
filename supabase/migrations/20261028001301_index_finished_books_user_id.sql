-- RLS on finished_books filters on user_id; the app loads an account's finished books by it, newest first.
create index concurrently if not exists finished_books_user_id_finished_on_idx on public.finished_books (user_id, finished_on);
