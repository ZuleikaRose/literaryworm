-- The foreign key (club_id, user_id) → club_members on club_highlights (migration 6565). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_highlights_club_id_user_id_idx on public.club_highlights (club_id, user_id);
