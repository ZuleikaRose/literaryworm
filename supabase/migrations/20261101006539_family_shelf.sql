-- The family shelf: catalog books a grown-up or teen profile puts out for the whole household,
-- shown as a row on every profile's Home. Per account, up to 100 books. Kids profiles see only
-- the ones their rating (or a grown-up's yes to a request) already lets them open: the shelf never
-- opens a book. A Kids profile can't add to it (trigger). A book added by a profile that's later
-- deleted stays, without its name. Index on added_by for its foreign key in the next migration;
-- the primary key covers user_id.

create table public.family_shelf (
  user_id    uuid not null references auth.users (id) on delete cascade,
  volume_id  text not null check (char_length(volume_id) between 1 and 64),
  added_by   uuid references public.reader_profiles (id) on delete set null,
  note       text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, volume_id)
);

create or replace function private.family_shelf_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.family_shelf where user_id = new.user_id) >= 100 then
    raise exception 'The family shelf holds up to 100 books' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.reader_profiles p
    where p.id = new.added_by and p.account_id = new.user_id and p.age_rating <> 'kids'
  ) then
    raise exception 'Only a grown-up or teen profile on this account can add to the family shelf' using errcode = 'check_violation';
  end if;
  new.note := btrim(new.note);
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function private.family_shelf_guard() from public, anon, authenticated;

create trigger family_shelf_guard
  before insert on public.family_shelf
  for each row execute function private.family_shelf_guard();

alter table public.family_shelf enable row level security;

create policy "Households see their family shelf" on public.family_shelf for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Households add to their family shelf" on public.family_shelf for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Households take books off their family shelf" on public.family_shelf for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.family_shelf as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.family_shelf from anon, authenticated;
grant select, delete on public.family_shelf to authenticated;
grant insert (user_id, volume_id, added_by, note) on public.family_shelf to authenticated;
