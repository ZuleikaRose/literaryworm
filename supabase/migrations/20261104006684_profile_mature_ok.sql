-- The age gate for books marked mature (lib/adultGate.ts): when an adult profile confirms it's 18 or
-- older to open one, the time is kept here, so it isn't asked again on any device. Kids and Teen
-- profiles never open those books (the app shows Not on this shelf), so for them it's always null.
-- RLS on reader_profiles already limits rows to the account's own.

alter table public.reader_profiles add column mature_ok_at timestamptz;

grant select (mature_ok_at) on public.reader_profiles to authenticated;
grant update (mature_ok_at) on public.reader_profiles to authenticated;

-- Only an adult ("all") profile can say it's an adult; changing a profile's rating clears it.
create or replace function private.mature_ok_adults_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.age_rating <> 'all' then
    new.mature_ok_at := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.mature_ok_adults_only() from public, anon, authenticated;

create trigger mature_ok_adults_only
  before insert or update of mature_ok_at, age_rating on public.reader_profiles
  for each row execute function private.mature_ok_adults_only();
