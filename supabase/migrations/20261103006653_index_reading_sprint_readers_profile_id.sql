-- Index for the foreign key reading_sprint_readers.profile_id (6649).
create index concurrently if not exists reading_sprint_readers_profile_id_idx on public.reading_sprint_readers (profile_id);
