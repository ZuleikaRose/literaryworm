-- Maintenance notices: a banner across the site before and during planned work, such as
-- "Updates on Sat 2 Nov, 02:00–02:30 UTC: you may be logged out briefly".
--
-- Developers and admins write them (has_staff_role('developer') is true for admins too), from
-- /maintenance in the app. Everyone, visitors included, reads the ones showing now: from
-- `announce_at` until `ends_at`. Staff read every notice, past and future. Nothing in a notice is
-- about a member; `created_by` and `updated_by` say which member of staff wrote or last changed it.
--
-- The indexes on created_by and updated_by are in migrations 6513 and 6514 (CREATE INDEX CONCURRENTLY runs on its own).

create table public.maintenance_notices (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  message     text not null check (char_length(btrim(message)) between 1 and 500),
  -- When the banner starts showing (announcing the work ahead of time), when the work starts, and
  -- when it ends (the banner goes then).
  announce_at timestamptz not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (announce_at <= starts_at),
  check (starts_at < ends_at),
  check (ends_at - starts_at <= interval '7 days'),
  check (starts_at - announce_at <= interval '30 days')
);

-- Keep the list short enough to read: at most 100 notices (old ones can be deleted).
create or replace function private.maintenance_notice_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.maintenance_notices) >= 100 then
      raise exception 'There are 100 notices already. Delete old ones first' using errcode = 'check_violation';
    end if;
    new.created_by := (select auth.uid());
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.maintenance_notice_rules() from public, anon, authenticated;

create trigger maintenance_notices_rules
  before insert or update on public.maintenance_notices
  for each row execute function private.maintenance_notice_rules();

alter table public.maintenance_notices enable row level security;

create policy "Everyone sees notices that are showing" on public.maintenance_notices for select to anon, authenticated
  using (announce_at <= now() and ends_at > now());
create policy "Developers and admins see every notice" on public.maintenance_notices for select to authenticated
  using ((select public.has_staff_role('developer')));
create policy "Developers and admins add notices" on public.maintenance_notices for insert to authenticated
  with check ((select public.has_staff_role('developer')));
create policy "Developers and admins change notices" on public.maintenance_notices for update to authenticated
  using ((select public.has_staff_role('developer'))) with check ((select public.has_staff_role('developer')));
create policy "Developers and admins delete notices" on public.maintenance_notices for delete to authenticated
  using ((select public.has_staff_role('developer')));
-- Writing needs the second step when it's on (reading what's showing doesn't: it's public).
create policy "Two-step sign-in to add notices" on public.maintenance_notices as restrictive for insert to authenticated
  with check ((select public.second_step_done()));
create policy "Two-step sign-in to change notices" on public.maintenance_notices as restrictive for update to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
create policy "Two-step sign-in to delete notices" on public.maintenance_notices as restrictive for delete to authenticated
  using ((select public.second_step_done()));

revoke all on public.maintenance_notices from anon, authenticated;
grant select (id, title, message, announce_at, starts_at, ends_at) on public.maintenance_notices to anon;
grant select on public.maintenance_notices to authenticated;
grant insert (title, message, announce_at, starts_at, ends_at) on public.maintenance_notices to authenticated;
grant update (title, message, announce_at, starts_at, ends_at) on public.maintenance_notices to authenticated;
grant delete on public.maintenance_notices to authenticated;
