-- Index for the foreign key on book_clubs (owner_id).
create index concurrently if not exists book_clubs_owner_id_idx on public.book_clubs (owner_id);
