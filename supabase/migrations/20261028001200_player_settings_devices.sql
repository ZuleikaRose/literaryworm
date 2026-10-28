-- The audiobook player's settings, and listening on another device (Phase 13).
--
-- Player settings belong to one household profile, like recent searches, so
-- they live on reader_profiles: volume, mute, how far the skip buttons move,
-- and whether each chapter's spoken introduction and closing announcement are
-- skipped as they come.
--
-- listening_devices: every open copy of the app while a member is signed in.
-- The browser makes the id (one per visit) and checks in every minute through
-- touch_listening_device(), which stamps the database's time. An account keeps
-- its 20 most recently seen devices; the app clears devices not seen for a day.
--
-- playback_handoffs: a book and a place sent from one of the account's devices
-- to another, for one of its profiles. The receiving device offers it (through
-- Supabase Realtime, and a check when the tab comes back) and marks it claimed.
-- Composite foreign keys keep the device and the profile the account's own;
-- clearing the device, the profile or the account clears its handoffs.

alter table public.reader_profiles
  add column player_volume        smallint not null default 100 check (player_volume between 0 and 100),
  add column player_muted         boolean  not null default false,
  add column skip_back_seconds    smallint not null default 15 check (skip_back_seconds in (5, 10, 15, 30, 45, 60)),
  add column skip_forward_seconds smallint not null default 15 check (skip_forward_seconds in (5, 10, 15, 30, 45, 60)),
  add column auto_skip_intro      boolean  not null default false,
  add column auto_skip_outro      boolean  not null default false;

grant select (player_volume, player_muted, skip_back_seconds, skip_forward_seconds, auto_skip_intro, auto_skip_outro)
  on public.reader_profiles to authenticated;
grant update (player_volume, player_muted, skip_back_seconds, skip_forward_seconds, auto_skip_intro, auto_skip_outro)
  on public.reader_profiles to authenticated;


create table public.listening_devices (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- "Chrome on Windows": worked out from the browser, shown in the list.
  label        text not null check (char_length(btrim(label)) between 1 and 60),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  -- Lets handoffs require "this device, of this account".
  unique (id, user_id)
);
-- The index for user_id (the foreign key and RLS) is in the 1201 migration.

alter table public.listening_devices enable row level security;

create policy "Members see their own devices" on public.listening_devices for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members add their own devices" on public.listening_devices for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Members check in their own devices" on public.listening_devices for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members clear their own devices" on public.listening_devices for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.listening_devices from anon, authenticated;
grant select, delete on public.listening_devices to authenticated;
grant insert (id, user_id, label) on public.listening_devices to authenticated;
grant update (last_seen_at) on public.listening_devices to authenticated;

-- Says a device is still open, with the database's clock (devices' clocks differ).
create or replace function public.touch_listening_device(p_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.listening_devices set last_seen_at = now()
  where id = p_id and user_id = (select auth.uid());
$$;

revoke execute on function public.touch_listening_device(uuid) from public, anon;
grant execute on function public.touch_listening_device(uuid) to authenticated;

-- An account keeps its 20 most recently seen devices: each visit adds one.
create or replace function public.keep_recent_listening_devices()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.listening_devices
  where user_id = new.user_id
    and id not in (
      select d.id from public.listening_devices d
      where d.user_id = new.user_id
      order by d.last_seen_at desc
      limit 20
    );
  return null;
end;
$$;

create trigger listening_devices_keep_recent
  after insert on public.listening_devices
  for each row execute function public.keep_recent_listening_devices();


create table public.playback_handoffs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  profile_id       uuid not null,
  volume_id        text not null check (char_length(volume_id) between 1 and 64),
  -- Where to carry on, in seconds from the start of the book.
  position_seconds integer not null check (position_seconds between 0 and 360000),
  -- The sending device's name as it was when sent.
  from_label       text not null check (char_length(btrim(from_label)) between 1 and 60),
  to_device_id     uuid not null,
  created_at       timestamptz not null default now(),
  -- Set when the receiving device picks it up or turns it down.
  claimed_at       timestamptz,
  foreign key (to_device_id, user_id) references public.listening_devices (id, user_id) on delete cascade,
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);
-- The foreign keys' indexes are in the 1202 and 1203 migrations.

alter table public.playback_handoffs enable row level security;

create policy "Members see their own handoffs" on public.playback_handoffs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members send their own handoffs" on public.playback_handoffs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Members claim their own handoffs" on public.playback_handoffs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members clear their own handoffs" on public.playback_handoffs for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.playback_handoffs from anon, authenticated;
grant select, delete on public.playback_handoffs to authenticated;
grant insert (user_id, profile_id, volume_id, position_seconds, from_label, to_device_id) on public.playback_handoffs to authenticated;
grant update (claimed_at) on public.playback_handoffs to authenticated;

-- The receiving device hears of new handoffs straight away (Realtime applies the RLS above).
alter publication supabase_realtime add table public.playback_handoffs;
