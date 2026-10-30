-- Foreign-key index. Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_meeting_changes_changed_by_idx on public.club_meeting_changes (changed_by);
