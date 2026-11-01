-- The foreign key on club_meeting_pushes.user_id (migration 6550). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_meeting_pushes_user_id_idx on public.club_meeting_pushes (user_id);
