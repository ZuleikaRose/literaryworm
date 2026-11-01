-- The foreign key on club_highlights.highlight_id (migration 6565). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_highlights_highlight_id_idx on public.club_highlights (highlight_id);
