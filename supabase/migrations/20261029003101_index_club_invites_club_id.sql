-- Kept to one statement: CONCURRENTLY can't run in a transaction. Leads with club_id, so it
-- also indexes that foreign key; email_hash and created_at serve the "invited this week?" check.
create index concurrently if not exists club_invites_club_id_email_hash_idx on public.club_invites (club_id, email_hash, created_at);
