-- Index for the foreign key reading_sprint_readers.account_id (6649).
create index concurrently if not exists reading_sprint_readers_account_id_idx on public.reading_sprint_readers (account_id);
