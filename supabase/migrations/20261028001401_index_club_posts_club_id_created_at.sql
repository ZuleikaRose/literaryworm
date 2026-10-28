-- club_unread() and each club's discussion read posts by club, newest after a time.
create index concurrently if not exists club_posts_club_id_created_at_idx on public.club_posts (club_id, created_at);
