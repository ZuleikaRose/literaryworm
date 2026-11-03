-- Index for the foreign key reading_sprints.started_by (6649).
create index concurrently if not exists reading_sprints_started_by_idx on public.reading_sprints (started_by);
