-- The foreign key club_pace_votes.user_id (club_id leads the primary key).
create index concurrently if not exists club_pace_votes_user_id_idx on public.club_pace_votes (user_id);
