-- Book clubs (Phase 12).
--
-- A member starts a club around one LiteraryWorm title, with a finish date the
-- club paces itself to, and shares its invite code. Other members join with the
-- code through join_club(); nobody can find a club any other way. Members see
-- the club, each other's display names and the discussion, which is grouped by
-- chapter so the app can hide posts about chapters a reader hasn't reached.
--
-- Clubs belong to accounts (like the library), not household profiles; the app
-- doesn't offer them to Kids profiles. Leaving a club deletes your posts in it
-- (they're tied to the membership), and deleting a club deletes everything in it.

create table public.book_clubs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  volume_id   text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  starts_on   date not null default current_date,
  finishes_on date not null,
  -- 10 random letters and digits, made by the app; changing it stops the old code working.
  invite_code text not null unique check (invite_code ~ '^[A-Za-z0-9]{10}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (finishes_on > starts_on and finishes_on <= starts_on + 366)
);

create trigger book_clubs_set_updated_at
  before update on public.book_clubs
  for each row execute function public.set_updated_at();

create table public.club_members (
  club_id   uuid not null references public.book_clubs (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.club_posts (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  body          text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Only members post; leaving the club removes the membership and these posts.
  foreign key (club_id, user_id) references public.club_members (club_id, user_id) on delete cascade
);

create trigger club_posts_set_updated_at
  before update on public.club_posts
  for each row execute function public.set_updated_at();

-- Is the caller a member of this club? SECURITY DEFINER so policies on
-- club_members can use it without querying club_members under its own RLS
-- (which would recurse). It answers only about the caller, with a yes or no.
create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = (select auth.uid())
  );
$$;
revoke execute on function public.is_club_member(uuid) from public, anon;
grant execute on function public.is_club_member(uuid) to authenticated;

-- The owner joins their own club; limits on clubs per account and posts per hour.
create or replace function private.book_club_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'book_clubs' then
    if (select count(*) from public.book_clubs where owner_id = new.owner_id) > 20 then
      raise exception 'An account can run up to 20 clubs' using errcode = 'check_violation';
    end if;
    insert into public.club_members (club_id, user_id) values (new.id, new.owner_id);
  elsif (select count(*) from public.club_posts
         where user_id = new.user_id and created_at > now() - interval '1 hour') > 60 then
    raise exception 'Too many posts. Wait a little and try again.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.book_club_rules() from public, anon, authenticated;

create trigger book_clubs_rules
  after insert on public.book_clubs
  for each row execute function private.book_club_rules();

create trigger club_posts_rules
  after insert on public.club_posts
  for each row execute function private.book_club_rules();

-- Joins the club with this invite code and returns its id, or null for a wrong
-- code. SECURITY DEFINER because a non-member can't see the club to join it;
-- it checks the code's shape, the caller, a 50-member cap, and limits tries
-- (20 an hour per account) so codes can't be guessed.
create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_club uuid;
begin
  if v_user is null then
    raise exception 'Log in to join a club' using errcode = 'insufficient_privilege';
  end if;
  if not public.check_rate_limit('join_club:' || v_user::text, 20, 3600) then
    raise exception 'Too many tries. Wait an hour and try again.' using errcode = 'check_violation';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9]{10}$' then
    return null;
  end if;
  select id into v_club from public.book_clubs where invite_code = p_code;
  if v_club is null then
    return null;
  end if;
  if not exists (select 1 from public.club_members where club_id = v_club and user_id = v_user) then
    if (select count(*) from public.club_members where club_id = v_club) >= 50 then
      raise exception 'This club is full (50 members)' using errcode = 'check_violation';
    end if;
    insert into public.club_members (club_id, user_id) values (v_club, v_user);
  end if;
  return v_club;
end;
$$;
revoke execute on function public.join_club(text) from public, anon;
grant execute on function public.join_club(text) to authenticated;

alter table public.book_clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_posts enable row level security;

create policy "Members see their clubs" on public.book_clubs for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_club_member(id));
create policy "Members start clubs as themselves" on public.book_clubs for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners change their clubs" on public.book_clubs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners delete their clubs" on public.book_clubs for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Members see who is in their clubs" on public.club_members for select to authenticated
  using (public.is_club_member(club_id));
-- Leaving: anyone but the owner (who deletes the club instead); owners can also remove members.
create policy "Members leave, owners remove" on public.club_members for delete to authenticated
  using (
    exists (
      select 1 from public.book_clubs c
      where c.id = club_id
        and ((user_id = (select auth.uid()) and c.owner_id <> user_id) or (c.owner_id = (select auth.uid()) and user_id <> c.owner_id))
    )
  );

create policy "Members read their clubs' posts" on public.club_posts for select to authenticated
  using (public.is_club_member(club_id));
create policy "Members post as themselves" on public.club_posts for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_club_member(club_id));
create policy "Members edit their own posts" on public.club_posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members delete their own posts, owners any in their club" on public.club_posts for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.book_clubs c where c.id = club_id and c.owner_id = (select auth.uid()))
  );

revoke all on public.book_clubs, public.club_members, public.club_posts from anon, authenticated;
grant select, delete on public.book_clubs to authenticated;
-- The app makes the club's id, so it needn't read the new row back before the owner is a member.
grant insert (id, owner_id, name, volume_id, starts_on, finishes_on, invite_code) on public.book_clubs to authenticated;
grant update (name, finishes_on, invite_code) on public.book_clubs to authenticated;
grant select, delete on public.club_members to authenticated;
grant select, delete on public.club_posts to authenticated;
grant insert (club_id, user_id, chapter_index, body) on public.club_posts to authenticated;
grant update (body) on public.club_posts to authenticated;
