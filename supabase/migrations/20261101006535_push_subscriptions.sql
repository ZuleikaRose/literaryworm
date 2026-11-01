-- Notifications on a device (Web Push). A member turns them on per browser in Account →
-- Preferences; the browser's push service gives an endpoint and two keys, kept here so the
-- release-emails function can send "out today" for reminded books to every device the account
-- turned them on for. Signing out or turning them off deletes the device's row; a push service
-- saying the browser has unsubscribed (404, 410) does too. Up to 20 devices an account.
--
-- The browser reads and deletes its account's rows but never writes them directly: an endpoint
-- belongs to one browser, and save_push_subscription() moves it to whoever signed in there last.
-- Index on user_id for the foreign key in the next migration.

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  endpoint     text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 2000),
  p256dh       text not null check (char_length(p256dh) between 80 and 100),
  auth         text not null check (char_length(auth) between 16 and 32),
  device_label text not null default '' check (char_length(device_label) <= 120),
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);

alter table public.push_subscriptions enable row level security;

create policy "Members see their own devices' notifications" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Members turn off their own devices' notifications" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.push_subscriptions as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, endpoint, device_label, created_at) on public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;

-- Saves this browser's subscription for the caller, taking the endpoint over from any account
-- that signed in on the browser before. Returns the row's id.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_label text default '')
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  if not public.second_step_done() then
    raise exception 'Enter the code from your authenticator app first.' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> v_user;
  if not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint)
     and (select count(*) from public.push_subscriptions where user_id = v_user) >= 20 then
    raise exception 'Notifications are on for 20 devices already. Turn them off on one first.' using errcode = 'check_violation';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
  values (v_user, p_endpoint, p_p256dh, p_auth, left(coalesce(p_label, ''), 120))
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, device_label = excluded.device_label
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Release-day notifications: each reminder once, like the email (emailed_at).
alter table public.release_reminders add column pushed_at timestamptz;

-- Marks due reminders as pushed and returns them, for accounts with a device to send to.
create or replace function public.claim_release_pushes(max_count integer default 200)
returns table (user_id uuid, profile_name text, volume_id text, title text, author text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select r.profile_id, r.user_id, r.volume_id
    from public.release_reminders r
    where r.pushed_at is null
      and r.release_date <= current_date
      and r.release_date > current_date - 7
      and exists (select 1 from public.push_subscriptions s where s.user_id = r.user_id)
    order by r.user_id, r.release_date
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update of r skip locked
  ), claimed as (
    update public.release_reminders r
    set pushed_at = now()
    from due
    where r.profile_id = due.profile_id and r.user_id = due.user_id and r.volume_id = due.volume_id
    returning r.user_id, r.profile_id, r.volume_id, r.title, r.author
  )
  select c.user_id, rp.name, c.volume_id, c.title, c.author
  from claimed c
  left join public.reader_profiles rp on rp.id = c.profile_id
  order by c.user_id, c.title;
end;
$$;

revoke execute on function public.claim_release_pushes(integer) from public, anon, authenticated;
grant execute on function public.claim_release_pushes(integer) to service_role;
