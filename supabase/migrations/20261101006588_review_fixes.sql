-- Fixes from the Copilot review of the 2026-11-01 release (PR #2).
--
-- 1. Reading plans are saved with an upsert (saveReadingPlan()), and PostgREST's ON CONFLICT DO UPDATE
--    sets every column it was sent, the key columns too, so members need UPDATE on them. RLS (own rows)
--    and the foreign key to reader_profiles (profile_id, account_id) still hold every row to its owner.
-- 2. The 20-plan limit runs in a BEFORE INSERT trigger, which fires for an upsert before its conflict
--    turns it into an update: changing the date of an existing plan at 20 was refused. The count now
--    leaves out the plan being saved.
-- 3. fit_profiles_to_plan() no longer sets profiles aside when a running membership only moves between
--    active and past_due, so a Standard household over the new room of 3 keeps its profiles after a
--    failed payment, as the Terms promise.

grant update (profile_id, user_id, volume_id) on public.reading_plans to authenticated;

create or replace function private.reading_plans_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The browser sends its own day; allow a day either side of the server's for time zones.
  if new.finish_by < current_date - 1 or new.finish_by > current_date + 731 then
    raise exception 'Choose a day from today to two years ahead' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    -- An upsert of a plan that exists becomes an update, so it doesn't count towards the 20.
    if (select count(*) from public.reading_plans p
        where p.profile_id = new.profile_id and p.user_id = new.user_id and p.volume_id <> new.volume_id) >= 20
       and not exists (select 1 from public.reading_plans p
        where p.profile_id = new.profile_id and p.user_id = new.user_id and p.volume_id = new.volume_id) then
      raise exception 'A profile can have up to 20 reading plans' using errcode = 'check_violation';
    end if;
    if new.started_on not between current_date - 1 and current_date + 1 then
      raise exception 'A plan starts today' using errcode = 'check_violation';
    end if;
    new.created_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function private.reading_plans_guard() from public, anon, authenticated;

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

  -- A running membership that only moves between active and past_due (a failed or recovered
  -- payment) keeps the profiles it has: a household already over its plan's room because the plan
  -- changed (Standard went from 5 to 3, migration 6585) isn't fitted until it changes plan or restarts.
  if in_use > allowed and tg_op = 'UPDATE' and old.status in ('active', 'past_due')
     and old.plan_id is not distinct from new.plan_id and old.switch_to_monthly is not distinct from new.switch_to_monthly then
    return null;
  end if;

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
