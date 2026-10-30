-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_meeting_changes_club_id_idx on public.club_meeting_changes (club_id);
