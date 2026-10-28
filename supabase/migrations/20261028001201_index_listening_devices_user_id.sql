-- RLS and the device list filter on user_id, newest check-in first; also indexes the foreign key.
create index concurrently if not exists listening_devices_user_id_last_seen_at_idx on public.listening_devices (user_id, last_seen_at);
