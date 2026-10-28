-- Index for the foreign key on club_listening (club_id, host_id) to club_members.
create index concurrently if not exists club_listening_club_id_host_id_idx on public.club_listening (club_id, host_id);
