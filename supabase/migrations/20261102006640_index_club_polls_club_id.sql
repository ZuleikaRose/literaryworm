-- The foreign key club_polls.club_id (club_polls_one_open covers only open polls).
create index concurrently if not exists club_polls_club_id_idx on public.club_polls (club_id, created_at);
