-- Remind Me for books that aren't out yet (story 48).
--
-- Per profile, like favourites. A reminder keeps the title, first author and
-- release date the book page showed, so Home and My Library can list it
-- without asking Google Books again. Once the date passes, Home shows it as
-- out now until the reader dismisses it (which deletes the reminder).
-- Up to 100 a profile; only for books not out yet.

create table public.release_reminders (
  profile_id   uuid not null,
  user_id      uuid not null,
  volume_id    text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  author       text check (char_length(author) <= 200),
  release_date date not null,
  created_at   timestamptz not null default now(),
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_reminder_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A day's slack either side of the reader's own date.
  if new.release_date < current_date - 1 then
    raise exception 'That book is already out' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.release_reminders where profile_id = new.profile_id) >= 100 then
    raise exception 'A profile can have up to 100 reminders' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_reminder_rules() from public, anon, authenticated;

create trigger release_reminders_rules
  before insert on public.release_reminders
  for each row execute function private.enforce_reminder_rules();

alter table public.release_reminders enable row level security;

create policy "Readers see their own reminders" on public.release_reminders for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers set reminders for their own profiles" on public.release_reminders for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers remove their own reminders" on public.release_reminders for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.release_reminders as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.release_reminders from anon, authenticated;
grant select, delete on public.release_reminders to authenticated;
grant insert (profile_id, user_id, volume_id, title, author, release_date) on public.release_reminders to authenticated;

-- The Privacy Policy and Children's Privacy Notice list what we keep: add
-- reminders (src/data/legalPages.json has the same change). The edit trigger
-- keeps the old version; a page an editor has reworded since is left as it is.
update public.legal_pages
set sections = replace(sections::text, 'the authors and narrators you follow, recent searches',
                       'the authors and narrators you follow, release reminders, recent searches')::jsonb
where slug = 'privacy' and sections::text like '%the authors and narrators you follow, recent searches%';

update public.legal_pages
set sections = replace(sections::text, 'the authors and narrators it follows, reading time and goals',
                       'the authors and narrators it follows, release reminders, reading time and goals')::jsonb
where slug = 'childrens-privacy' and sections::text like '%the authors and narrators it follows, reading time and goals%';
