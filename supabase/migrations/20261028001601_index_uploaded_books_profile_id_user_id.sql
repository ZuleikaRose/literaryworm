-- Index for the foreign key on uploaded_books (profile_id, user_id); also the profile's list.
create index concurrently if not exists uploaded_books_profile_id_user_id_idx on public.uploaded_books (profile_id, user_id);
