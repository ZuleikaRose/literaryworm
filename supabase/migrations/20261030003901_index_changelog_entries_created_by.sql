-- Indexes changelog_entries.created_by (its foreign key to auth.users). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists changelog_entries_created_by on public.changelog_entries (created_by);
