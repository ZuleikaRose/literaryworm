-- Indexes household_challenges.user_id (its foreign key to auth.users). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists household_challenges_user_id on public.household_challenges (user_id);
