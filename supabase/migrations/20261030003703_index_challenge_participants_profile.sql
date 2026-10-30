-- Indexes challenge_participants (profile_id, user_id), its foreign key to reader_profiles. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists challenge_participants_profile on public.challenge_participants (profile_id, user_id);
