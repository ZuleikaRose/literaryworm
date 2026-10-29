-- Kept to one statement: CONCURRENTLY can't run in a transaction. Leads with invited_by, so it
-- also indexes that foreign key; created_at serves the "10 a day" check.
create index concurrently if not exists club_invites_invited_by_created_at_idx on public.club_invites (invited_by, created_at);
