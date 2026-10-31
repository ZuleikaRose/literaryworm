-- Reading journal: a profile's private, dated entries about a book, kept apart from the
-- public logs (which carry the display name). Per profile, like saved_words; the browser makes
-- the id. Up to 1,000 a profile. Deleting the profile (or the account) deletes them through
-- the foreign key. Index on (profile_id, user_id) for the foreign key in the next migration.

create table public.journal_entries (
  id         uuid primary key,
  profile_id uuid not null,
  user_id    uuid not null,
  volume_id  text not null check (char_length(volume_id) between 1 and 64),
  body       text not null check (char_length(btrim(body)) between 1 and 5000),
  written_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.journal_entries_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.journal_entries where profile_id = new.profile_id) >= 1000 then
      raise exception 'A profile can keep up to 1000 journal entries' using errcode = 'check_violation';
    end if;
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  -- Today or a day before, a day's leeway either side for time zones.
  if new.written_on > current_date + 1 then
    raise exception 'A journal entry is about today or a day before' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.journal_entries_guard() from public, anon, authenticated;

create trigger journal_entries_guard
  before insert or update on public.journal_entries
  for each row execute function private.journal_entries_guard();

alter table public.journal_entries enable row level security;

create policy "Readers see their own journal" on public.journal_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers write in their own journal" on public.journal_entries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers edit their own journal" on public.journal_entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers delete from their own journal" on public.journal_entries for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.journal_entries as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.journal_entries from anon, authenticated;
grant select, delete on public.journal_entries to authenticated;
grant insert (id, profile_id, user_id, volume_id, body, written_on) on public.journal_entries to authenticated;
grant update (body, written_on) on public.journal_entries to authenticated;
