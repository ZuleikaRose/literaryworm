-- Index for the foreign key on club_members (user_id).
create index concurrently if not exists club_members_user_id_idx on public.club_members (user_id);
