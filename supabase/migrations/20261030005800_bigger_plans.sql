-- Bigger households: Standard now has 5 profiles and Read offline on 10 devices, Premium 12
-- profiles and 24 devices (Basic is unchanged: 1 and 1). src/data/plans.ts has the same numbers.
--
-- Profiles were capped at 5 for every plan (the plans check and the trigger's least(…, 5)); the
-- cap is now 12, Premium's. Offline device places are counted by claim_offline_device() against
-- plans.download_devices, so the new numbers apply as soon as they're saved.

alter table public.plans drop constraint plans_max_profiles_check;
alter table public.plans add constraint plans_max_profiles_check check (max_profiles between 1 and 12);

update public.plans set max_profiles = 5, download_devices = 10 where id = 'standard';
update public.plans set max_profiles = 12, download_devices = 24 where id = 'premium';

create or replace function private.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed smallint;
  used    integer;
begin
  -- Serialize concurrent inserts for one account so two requests can't both
  -- slip under the limit.
  perform pg_advisory_xact_lock(hashtext('reader_profiles:' || new.account_id::text));

  select least(p.max_profiles, 12) into allowed
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = new.account_id and s.status in ('active', 'past_due');

  select count(*) into used from public.reader_profiles where account_id = new.account_id;

  if used >= coalesce(allowed, 1) then
    raise exception 'This plan allows % profile(s)', coalesce(allowed, 1)
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
