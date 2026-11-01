-- The foreign key club_members.own_copy → uploaded_books (migration 6589). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists club_members_own_copy_idx on public.club_members (own_copy);
