-- RLS on uploaded_books filters on user_id; the app loads an account's uploads by it.
create index concurrently if not exists uploaded_books_user_id_idx on public.uploaded_books (user_id);
