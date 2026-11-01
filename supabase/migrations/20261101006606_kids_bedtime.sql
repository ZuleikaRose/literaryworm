-- Bedtime for Kids profiles: a grown-up picks a bedtime and a wake-up time in the profile editor;
-- between them, on the device's clock, the reader and the player show Time for bed. Like the
-- daily limit it's the account holder's call, so only the manage-profile function (set_bedtime,
-- with the account password, service role) writes it: the browser is granted select only.
-- Both or neither; moving a profile off Kids clears it (src/lib/bedtime.ts has the same choices).

alter table public.reader_profiles
  add column bedtime time check (bedtime in ('19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00')),
  add column wake_time time check (wake_time in ('06:00', '06:30', '07:00', '07:30', '08:00')),
  add constraint reader_profiles_bedtime_pair check ((bedtime is null) = (wake_time is null));
grant select (bedtime, wake_time) on public.reader_profiles to authenticated;

create or replace function private.clear_bedtime_off_kids()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.age_rating <> 'kids' then
    new.bedtime := null;
    new.wake_time := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.clear_bedtime_off_kids() from public, anon, authenticated;

create trigger reader_profiles_clear_bedtime
  before insert or update of age_rating, bedtime, wake_time on public.reader_profiles
  for each row execute function private.clear_bedtime_off_kids();
