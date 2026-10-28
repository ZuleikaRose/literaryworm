-- Index for the foreign key on club_posts (user_id).
create index concurrently if not exists club_posts_user_id_idx on public.club_posts (user_id);
