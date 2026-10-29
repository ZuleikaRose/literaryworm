-- Follow an author or narrator (story 35).
--
-- Per profile, like favourites: each profile follows its own authors and
-- narrators, and their page shows Following. The name is the one shown on the
-- book (the catalog's author or narrator, or Google Books' author), which is
-- also how the page is found. Up to 200 a profile.

create table public.follows (
  profile_id uuid not null,
  user_id    uuid not null,
  kind       text not null check (kind in ('author', 'narrator')),
  name       text not null check (char_length(name) between 1 and 100 and name = btrim(name)),
  created_at timestamptz not null default now(),
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, kind, name),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_follow_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.follows where profile_id = new.profile_id) >= 200 then
    raise exception 'A profile can follow up to 200 authors and narrators' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_follow_limit() from public, anon, authenticated;

create trigger follows_limit
  before insert on public.follows
  for each row execute function private.enforce_follow_limit();

alter table public.follows enable row level security;

create policy "Readers see who they follow" on public.follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers follow for their own profiles" on public.follows for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers unfollow" on public.follows for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.follows as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (profile_id, user_id, kind, name) on public.follows to authenticated;

-- The Privacy Policy and Children's Privacy Notice list what we keep: add follows
-- (src/data/legalPages.json has the same change). The edit trigger keeps the old
-- version; a page an editor has reworded since is left as it is.
update public.legal_pages
set sections = replace(sections::text, 'ratings, favourites and lists, recent searches',
                       'ratings, favourites and lists, the authors and narrators you follow, recent searches')::jsonb
where slug = 'privacy' and sections::text like '%ratings, favourites and lists, recent searches%';

update public.legal_pages
set sections = replace(sections::text, 'ratings, favourites and lists, reading time and goals',
                       'ratings, favourites and lists, the authors and narrators it follows, reading time and goals')::jsonb
where slug = 'childrens-privacy' and sections::text like '%ratings, favourites and lists, reading time and goals%';
