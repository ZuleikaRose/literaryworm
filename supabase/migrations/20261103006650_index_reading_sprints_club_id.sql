-- Index for the foreign key reading_sprints.club_id (6649).
create index concurrently if not exists reading_sprints_club_id_idx on public.reading_sprints (club_id);
