-- Indexes the (profile_id, user_id) foreign key, so deleting a profile finds its handoffs quickly.
create index concurrently if not exists playback_handoffs_profile_id_user_id_idx on public.playback_handoffs (profile_id, user_id);
