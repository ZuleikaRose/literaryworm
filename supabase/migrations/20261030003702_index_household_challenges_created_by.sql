-- Indexes household_challenges (created_by, user_id), its foreign key to reader_profiles. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists household_challenges_created_by on public.household_challenges (created_by, user_id);
