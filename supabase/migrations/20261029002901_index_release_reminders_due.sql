-- Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists release_reminders_due_idx on public.release_reminders (release_date) where emailed_at is null;
