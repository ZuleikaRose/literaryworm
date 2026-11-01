-- The foreign key on family_shelf.added_by (migration 6539). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists family_shelf_added_by_idx on public.family_shelf (added_by);
