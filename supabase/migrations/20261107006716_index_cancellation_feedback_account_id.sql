-- Index the foreign key on cancellation_feedback (its own migration: CREATE INDEX CONCURRENTLY).
create index concurrently if not exists cancellation_feedback_account_id_idx on public.cancellation_feedback (account_id);
