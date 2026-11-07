-- The foreign key natural_voice_profile_usage (profile_id, account_id) (account_id leads the primary key).
create index concurrently if not exists natural_voice_profile_usage_profile_idx on public.natural_voice_profile_usage (profile_id, account_id);
