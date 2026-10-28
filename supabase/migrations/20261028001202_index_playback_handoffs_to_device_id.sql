-- A device looks up the handoffs sent to it; also indexes the (to_device_id, user_id) foreign key.
create index concurrently if not exists playback_handoffs_to_device_id_user_id_idx on public.playback_handoffs (to_device_id, user_id);
