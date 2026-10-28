-- Index for the foreign key on club_posts (club_id, user_id), and for reading a club's posts.
create index concurrently if not exists club_posts_club_id_user_id_idx on public.club_posts (club_id, user_id);
