-- Following readers: a member can turn on a reader page (profiles.public_reader, off
-- by default), which lists the logs they publish under their display name; other
-- members' grown-up and teen profiles can then follow them and see their newest logs
-- in My Library -> Readers. Logs and display names were already public; the switch
-- only gathers a reader's logs on one page and lets others follow it.
--
-- Who follows whom is private: only the follower's account reads its rows (no counts
-- are shown). A reader can't be followed unless their page is on, nobody follows
-- themselves, and turning the page off removes every follow of it. Up to 200 a profile.

alter table public.profiles add column public_reader boolean not null default false;

grant select (public_reader) on public.profiles to anon, authenticated;
grant update (public_reader) on public.profiles to authenticated;

create table public.reader_follows (
  profile_id uuid not null,
  user_id    uuid not null,
  reader_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (reader_id <> user_id),
  -- Leads with (profile_id, user_id), so it also indexes that foreign key; reader_id's
  -- index is in the 6506 migration.
  primary key (profile_id, user_id, reader_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_reader_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.reader_id and public_reader) then
    raise exception 'This reader''s page isn''t open to followers' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.reader_profiles where id = new.profile_id and age_rating = 'kids') then
    raise exception 'Kids profiles don''t follow readers' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.reader_follows where profile_id = new.profile_id) >= 200 then
    raise exception 'A profile can follow up to 200 readers' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_reader_follow() from public, anon, authenticated;

create trigger reader_follows_check
  before insert on public.reader_follows
  for each row execute function private.enforce_reader_follow();

-- Turning the reader page off removes its followers.
create or replace function private.drop_reader_followers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.reader_follows where reader_id = new.id;
  return new;
end;
$$;
revoke execute on function private.drop_reader_followers() from public, anon, authenticated;

create trigger profiles_reader_page_off
  after update of public_reader on public.profiles
  for each row when (old.public_reader and not new.public_reader)
  execute function private.drop_reader_followers();

alter table public.reader_follows enable row level security;

create policy "Readers see who they follow" on public.reader_follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers follow for their own profiles" on public.reader_follows for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers unfollow" on public.reader_follows for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.reader_follows as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.reader_follows from anon, authenticated;
grant select, delete on public.reader_follows to authenticated;
grant insert (profile_id, user_id, reader_id) on public.reader_follows to authenticated;
