-- Profiles set aside, and a plan's room as it will be at renewal.
--
-- reader_profiles.set_aside_at: a profile set aside keeps its shelf, history and settings but
-- doesn't count towards the plan and can't be chosen in Who's reading? until it's brought back.
-- A grown-up sets one aside or brings it back through the manage-profile function (with the
-- account password); the browser can read the column but never write it.
--
-- private.profile_room(): how many profiles the account may use. The plan's, or the smaller of
-- the plan's and the one a yearly membership moves to at renewal (subscriptions.switch_to_monthly),
-- so a household can't grow past the smaller plan before the year ends. Offline device places
-- (claim_offline_device()) follow the same rule.
--
-- When an active membership's room changes (a smaller plan reaches the account, say), the newest
-- profiles over it are set aside; when there's room again (moving up a plan), the ones set aside
-- earliest come back. The oldest profile is always kept.

alter table public.reader_profiles add column set_aside_at timestamptz;
grant select (set_aside_at) on public.reader_profiles to authenticated;

create or replace function private.profile_room(p_account uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select least(p.max_profiles, coalesce(sp.max_profiles, p.max_profiles), 12)::smallint
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    left join public.plans sp on sp.id = s.switch_to_monthly
    where s.user_id = p_account and s.status in ('active', 'past_due')
  ), 1::smallint);
$$;
revoke execute on function private.profile_room(uuid) from public, anon, authenticated;

-- Adding a profile, or bringing one back, needs room among the profiles in use; no household keeps
-- more than 12 profiles in all (Premium's), set aside or not.
create or replace function private.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed smallint;
  in_use  integer;
  total   integer;
begin
  if tg_op = 'UPDATE' and not (old.set_aside_at is not null and new.set_aside_at is null) then
    return new;
  end if;
  -- Serialize concurrent changes for one account so two requests can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtext('reader_profiles:' || new.account_id::text));

  allowed := private.profile_room(new.account_id);
  select count(*) filter (where set_aside_at is null and id <> new.id), count(*) filter (where id <> new.id)
    into in_use, total
  from public.reader_profiles where account_id = new.account_id;

  if new.set_aside_at is null and in_use >= allowed then
    raise exception 'This plan allows % profile(s)', allowed
      using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and total >= 12 then
    raise exception 'A household keeps at most 12 profiles'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reader_profiles_enforce_limit_on_return
  before update of set_aside_at on public.reader_profiles
  for each row execute function private.enforce_profile_limit();

-- Sets aside the newest profiles over the account's room, or brings back the ones set aside
-- earliest while there's room. Only for an active membership: a paused or ended one changes nothing.
create or replace function private.fit_profiles_to_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed smallint;
  in_use  integer;
begin
  if new.status not in ('active', 'past_due') then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('reader_profiles:' || new.user_id::text));
  allowed := private.profile_room(new.user_id);
  select count(*) into in_use from public.reader_profiles where account_id = new.user_id and set_aside_at is null;

  if in_use > allowed then
    update public.reader_profiles r set set_aside_at = now()
    where r.id in (
      select id from public.reader_profiles
      where account_id = new.user_id and set_aside_at is null
        -- Never the oldest: the account keeps at least one profile in use.
        and id <> (select id from public.reader_profiles where account_id = new.user_id order by created_at, id limit 1)
      order by created_at desc, id desc
      limit in_use - allowed
    );
  elsif in_use < allowed then
    update public.reader_profiles r set set_aside_at = null
    where r.id in (
      select id from public.reader_profiles
      where account_id = new.user_id and set_aside_at is not null
      order by set_aside_at, created_at
      limit allowed - in_use
    );
  end if;
  return null;
end;
$$;
revoke execute on function private.fit_profiles_to_plan() from public, anon, authenticated;

-- The webhook writes the whole row on every Stripe event: only a real change counts, or a profile
-- set aside by hand would come straight back.
create trigger subscriptions_fit_profiles_on_insert
  after insert on public.subscriptions
  for each row
  execute function private.fit_profiles_to_plan();

create trigger subscriptions_fit_profiles
  after update of plan_id, status, switch_to_monthly on public.subscriptions
  for each row
  when (old.plan_id is distinct from new.plan_id or old.status is distinct from new.status or old.switch_to_monthly is distinct from new.switch_to_monthly)
  execute function private.fit_profiles_to_plan();

-- Offline device places: the smaller of the plan's and, for a yearly membership moving to monthly
-- at renewal, the next plan's. Otherwise as in migration 4100.
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
  select case when sp.download_devices < p.download_devices then sp.download_devices else p.download_devices end,
         case when sp.download_devices < p.download_devices then sp.id else p.id end
    into v_limit, v_plan
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  left join public.plans sp on sp.id = s.switch_to_monthly
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
