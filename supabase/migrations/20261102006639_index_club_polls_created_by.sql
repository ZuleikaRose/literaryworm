-- The foreign key club_polls.created_by.
create index concurrently if not exists club_polls_created_by_idx on public.club_polls (created_by);
