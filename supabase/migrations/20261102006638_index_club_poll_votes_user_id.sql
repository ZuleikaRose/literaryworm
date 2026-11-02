-- The foreign key club_poll_votes.user_id (poll_id leads the primary key).
create index concurrently if not exists club_poll_votes_user_id_idx on public.club_poll_votes (user_id);
