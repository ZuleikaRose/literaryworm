-- Index for the foreign key reading_sprints.account_id (6649).
create index concurrently if not exists reading_sprints_account_id_idx on public.reading_sprints (account_id);
