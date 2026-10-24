-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists parental_consents_profile_id_idx on public.parental_consents (profile_id);
