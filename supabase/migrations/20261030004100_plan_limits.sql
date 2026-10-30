-- Plan limits: each plan's audiobook hours a month and offline devices (public.plans
-- audio_hours and download_devices, shown on the plan cards) are now kept.
--
-- Listening: the app pauses the player once the account's listening this month reaches the
-- plan's hours. listening_minutes_between() gives it the account's saved listening (every
-- profile, every device) so time on another device counts too.
--
-- Offline devices: a device that keeps books with Read offline holds one of the plan's
-- device places. claim_offline_device() gives a place (or confirms one the device already
-- has) and refuses when the plan's places are taken, listing the devices holding them so
-- the member can free one. A device whose place is freed clears its offline books the next
-- time it opens. Staff memberships are Premium (5 devices, unlimited listening).

-- The account's listening, in whole minutes, from p_from to p_to (at most a month and a bit).
create or replace function public.listening_minutes_between(p_from date, p_to date)
returns integer
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 31 then
    raise exception 'p_from and p_to must be at most 31 days apart' using errcode = 'check_violation';
  end if;
  return coalesce((
    select sum(d.listening_minutes)::integer
    from public.reading_days d
    where d.user_id = (select auth.uid()) and d.day between p_from and p_to
  ), 0);
end;
$$;

revoke execute on function public.listening_minutes_between(date, date) from public, anon;
grant execute on function public.listening_minutes_between(date, date) to authenticated;

create table public.offline_devices (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- "Chrome on Windows": worked out from the browser, shown when choosing one to free.
  label        text not null check (char_length(btrim(label)) between 1 and 60),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
-- The index for user_id (the foreign key and RLS) is in the 4101 migration.

alter table public.offline_devices enable row level security;

create policy "Members see their own offline devices" on public.offline_devices for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members free their own offline devices" on public.offline_devices for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.offline_devices as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Places are only taken through claim_offline_device(), which checks the plan.
revoke all on public.offline_devices from anon, authenticated;
grant select, delete on public.offline_devices to authenticated;

create or replace function public.claim_offline_device(p_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_limit smallint;
  v_plan  text;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null or p_label is null or char_length(btrim(p_label)) not between 1 and 60 then
    raise exception 'a device id and a label of 1 to 60 characters are needed' using errcode = 'check_violation';
  end if;
  -- One claim at a time per account, so two devices can't both take the last place.
  perform pg_advisory_xact_lock(hashtextextended('offline_devices:' || v_user::text, 0));

  update public.offline_devices set last_seen_at = now(), label = btrim(p_label)
  where id = p_id and user_id = v_user;
  if found then
    return jsonb_build_object('status', 'ok');
  end if;
  if exists (select 1 from public.offline_devices where id = p_id) then
    raise exception 'that device id is taken' using errcode = 'unique_violation';
  end if;

  -- Without a membership row, the smallest plan's places.
  select p.download_devices, p.id into v_limit, v_plan
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.user_id = v_user;
  if v_limit is null then
    select p.download_devices, p.id into v_limit, v_plan from public.plans p where p.id = 'basic';
  end if;

  if (select count(*) from public.offline_devices where user_id = v_user) >= v_limit then
    return jsonb_build_object(
      'status', 'full',
      'plan_id', v_plan,
      'limit', v_limit,
      'devices', coalesce((
        select jsonb_agg(jsonb_build_object('id', d.id, 'label', d.label, 'last_seen_at', d.last_seen_at) order by d.last_seen_at desc)
        from public.offline_devices d where d.user_id = v_user
      ), '[]'::jsonb)
    );
  end if;

  insert into public.offline_devices (id, user_id, label) values (p_id, v_user, btrim(p_label));
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke execute on function public.claim_offline_device(uuid, text) from public, anon;
grant execute on function public.claim_offline_device(uuid, text) to authenticated;
