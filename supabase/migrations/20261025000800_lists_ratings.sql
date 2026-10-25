-- Favourites, ratings, custom lists and recent searches (Phase 10).
--
-- These belong to one household profile, not the whole account: each profile
-- keeps its own taste and lists. Every row carries the account (user_id) for
-- RLS, and a composite foreign key to reader_profiles(id, account_id) makes
-- sure the profile is that account's (deleting the profile or the account
-- deletes its rows). Keys start with (profile_id, user_id), so they also index
-- those foreign keys.
--
-- A custom list can be shared by link: its share_slug is a random 22-character
-- token the owner sets and clears. public.shared_list() is the only way to read
-- a shared list without signing in, and returns only the list's name,
-- description, the profile's name and its titles. Kids profiles can't share.

-- Lets child tables require "this profile, of this account".
alter table public.reader_profiles add constraint reader_profiles_id_account_id_key unique (id, account_id);

-- The last eight searches, newest first (kept on the profile row).
alter table public.reader_profiles
  add column recent_searches text[] not null default '{}'
    check (cardinality(recent_searches) <= 8 and char_length(array_to_string(recent_searches, '')) <= 800);
grant update (recent_searches) on public.reader_profiles to authenticated;
grant select (recent_searches) on public.reader_profiles to authenticated;

-- Not for me / I like this / I love this.
create type public.taste_rating as enum ('not_for_me', 'like', 'love');

create table public.book_ratings (
  profile_id uuid not null,
  user_id    uuid not null,
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  rating     public.taste_rating not null,
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create trigger book_ratings_set_updated_at
  before update on public.book_ratings
  for each row execute function public.set_updated_at();

create table public.favorites (
  profile_id uuid not null,
  user_id    uuid not null,
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create table public.custom_lists (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null,
  user_id     uuid not null,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  name_key    text generated always as (lower(btrim(name))) stored,
  description text not null default '' check (char_length(description) <= 200),
  -- Order on the Library page (0 first).
  position    smallint not null default 0 check (position between 0 and 99),
  -- Set while the list is shared by link; clearing it stops the link working.
  share_slug  text unique check (share_slug ~ '^[A-Za-z0-9_-]{22}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One name per profile; also the index for the foreign key below.
  unique (profile_id, user_id, name_key),
  -- The target of custom_list_items' foreign key.
  unique (id, user_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create trigger custom_lists_set_updated_at
  before update on public.custom_lists
  for each row execute function public.set_updated_at();

create table public.custom_list_items (
  list_id   uuid not null,
  user_id   uuid not null,
  volume_id text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  added_at  timestamptz not null default now(),
  primary key (list_id, user_id, volume_id),
  foreign key (list_id, user_id) references public.custom_lists (id, user_id) on delete cascade
);

-- Limits: 50 lists a profile, 200 books a list; and no sharing from Kids profiles.
create or replace function private.enforce_list_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'custom_lists' then
    if tg_op = 'INSERT' and (select count(*) from public.custom_lists where profile_id = new.profile_id) >= 50 then
      raise exception 'A profile can have up to 50 lists' using errcode = 'check_violation';
    end if;
    if new.share_slug is not null
       and (select age_rating from public.reader_profiles where id = new.profile_id) = 'kids' then
      raise exception 'Kids profiles can''t share lists' using errcode = 'check_violation';
    end if;
  elsif (select count(*) from public.custom_list_items where list_id = new.list_id) >= 200 then
    raise exception 'A list can hold up to 200 books' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_list_rules() from public, anon, authenticated;

create trigger custom_lists_rules
  before insert or update of share_slug on public.custom_lists
  for each row execute function private.enforce_list_rules();

create trigger custom_list_items_rules
  before insert on public.custom_list_items
  for each row execute function private.enforce_list_rules();

-- A profile that becomes Kids stops sharing its lists.
create or replace function private.unshare_kids_lists()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.age_rating = 'kids' and old.age_rating is distinct from 'kids' then
    update public.custom_lists set share_slug = null where profile_id = new.id and share_slug is not null;
  end if;
  return new;
end;
$$;
revoke execute on function private.unshare_kids_lists() from public, anon, authenticated;

create trigger reader_profiles_unshare_kids_lists
  after update of age_rating on public.reader_profiles
  for each row execute function private.unshare_kids_lists();

-- RLS: each account sees and changes only its own rows.
alter table public.book_ratings enable row level security;
alter table public.favorites enable row level security;
alter table public.custom_lists enable row level security;
alter table public.custom_list_items enable row level security;

create policy "Readers see their own ratings" on public.book_ratings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers rate as themselves" on public.book_ratings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers change their own ratings" on public.book_ratings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own ratings" on public.book_ratings for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own favourites" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers add their own favourites" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers remove their own favourites" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own lists" on public.custom_lists for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers create their own lists" on public.custom_lists for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers edit their own lists" on public.custom_lists for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers delete their own lists" on public.custom_lists for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers see their own list books" on public.custom_list_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers add to their own lists" on public.custom_list_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers remove from their own lists" on public.custom_list_items for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.book_ratings, public.favorites, public.custom_lists, public.custom_list_items from anon, authenticated;
grant select, delete on public.book_ratings to authenticated;
grant insert (profile_id, user_id, volume_id, rating) on public.book_ratings to authenticated;
grant update (rating) on public.book_ratings to authenticated;
grant select, delete on public.favorites to authenticated;
grant insert (profile_id, user_id, volume_id) on public.favorites to authenticated;
grant select, delete on public.custom_lists to authenticated;
grant insert (profile_id, user_id, name, description, position) on public.custom_lists to authenticated;
grant update (name, description, position, share_slug) on public.custom_lists to authenticated;
grant select, delete on public.custom_list_items to authenticated;
grant insert (list_id, user_id, volume_id) on public.custom_list_items to authenticated;

-- A shared list, for anyone with its link: only the name, description, the
-- profile's name and the titles in the order they were added. Nothing when the
-- link is wrong, sharing has stopped, or the profile is Kids.
create or replace function public.shared_list(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', l.name,
    'description', l.description,
    'owner', p.name,
    'updatedAt', l.updated_at,
    'items', coalesce(
      (select jsonb_agg(i.volume_id order by i.added_at) from public.custom_list_items i where i.list_id = l.id),
      '[]'::jsonb
    )
  )
  from public.custom_lists l
  join public.reader_profiles p on p.id = l.profile_id
  where p_slug ~ '^[A-Za-z0-9_-]{22}$'
    and l.share_slug = p_slug
    and p.age_rating <> 'kids';
$$;
revoke execute on function public.shared_list(text) from public;
grant execute on function public.shared_list(text) to anon, authenticated;
