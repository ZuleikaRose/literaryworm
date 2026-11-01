-- Book clubs around a book members uploaded (DRM-free EPUBs, including ones bought elsewhere).
--
-- An upload is a private copy, so it's never shared: the club keeps the book's title and author
-- (book_clubs.book_title, book_author, copied from the owner's upload by a trigger, never sent by the
-- browser), and each member links their own upload of it (club_members.own_copy, which must be one of
-- that member's uploaded_books). Everything that follows a member's place in the club's book uses the
-- member's own copy for an upload club: private.member_volume() gives it, and club_places(), the post
-- digest and push claims and shared highlights now go through it. Catalog clubs work as before.

alter table public.book_clubs
  add column book_title  text check (book_title is null or char_length(btrim(book_title)) between 1 and 200),
  add column book_author text check (book_author is null or char_length(book_author) <= 200);
alter table public.book_clubs
  add constraint book_clubs_upload_named check ((volume_id ~ '^u-[0-9a-f]{32}$') = (book_title is not null));

alter table public.club_members
  add column own_copy text references public.uploaded_books (id) on delete set null;
grant update (own_copy) on public.club_members to authenticated;

-- The volume a member reads for a club: the club's catalog title, or for an uploaded book the
-- member's own copy (null until they link one).
create or replace function private.member_volume(p_volume text, p_own_copy text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_volume ~ '^u-[0-9a-f]{32}$' then p_own_copy else p_volume end;
$$;
revoke execute on function private.member_volume(text, text) from public, anon, authenticated;

-- A new club on an upload: the upload must be the owner's; its title and author are copied.
create or replace function private.club_book_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_upload public.uploaded_books%rowtype;
begin
  if new.volume_id ~ '^u-[0-9a-f]{32}$' then
    select * into v_upload from public.uploaded_books u where u.id = new.volume_id and u.user_id = new.owner_id;
    if not found then
      raise exception 'Choose one of your own uploaded books' using errcode = 'check_violation';
    end if;
    new.book_title := v_upload.title;
    new.book_author := nullif(v_upload.author, '');
  else
    new.book_title := null;
    new.book_author := null;
  end if;
  return new;
end;
$$;
revoke execute on function private.club_book_fill() from public, anon, authenticated;

create trigger book_clubs_book_fill
  before insert on public.book_clubs
  for each row execute function private.club_book_fill();

-- A member's own copy: only for a club on an uploaded book, and only one of the member's own uploads.
create or replace function private.club_copy_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.own_copy is not null then
    if not exists (select 1 from public.book_clubs c where c.id = new.club_id and c.volume_id ~ '^u-[0-9a-f]{32}$') then
      raise exception 'Only a club reading an uploaded book uses your own copy' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.uploaded_books u where u.id = new.own_copy and u.user_id = new.user_id) then
      raise exception 'Choose one of your own uploaded books' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.club_copy_check() from public, anon, authenticated;

create trigger club_members_copy_check
  before insert or update of own_copy on public.club_members
  for each row execute function private.club_copy_check();

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
    -- An uploaded book's club starts with the owner's own copy linked.
    insert into public.club_members (club_id, user_id, own_copy)
    values (new.id, new.owner_id, case when new.volume_id ~ '^u-[0-9a-f]{32}$' then new.volume_id end);
  elsif (select count(*) from public.club_posts
         where user_id = new.user_id and created_at > now() - interval '1 hour') > 60 then
    raise exception 'Too many posts. Wait a little and try again.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.club_places(p_club uuid)
returns table (user_id uuid, display_name text, chapter_index smallint, fraction numeric, finished boolean, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Log in to do that.' using errcode = '42501';
  end if;
  if not public.second_step_done() then
    raise exception 'Enter the code from your authenticator app first.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.club_members m where m.club_id = p_club and m.user_id = v_user) then
    raise exception 'Only the club''s members can see where everyone is.' using errcode = '42501';
  end if;
  return query
  select m.user_id, p.display_name, rp.chapter_index, rp.position, rp.finished, rp.updated_at
  from public.club_members m
  join public.book_clubs c on c.id = m.club_id
  join public.reading_progress rp on rp.user_id = m.user_id and rp.volume_id = private.member_volume(c.volume_id, m.own_copy)
  left join public.profiles p on p.id = m.user_id
  where m.club_id = p_club and m.share_place
  order by rp.position desc, p.display_name;
end;
$$;

create or replace function public.claim_club_post_digests(max_count integer default 200)
returns table (
  user_id uuid, email text, member_name text,
  club_id uuid, club_name text, volume_id text,
  chapter_index smallint, posts bigint, authors text[],
  was_through timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_until timestamptz := now() - interval '1 minute';
begin
  return query
  with fresh as (
    select m.user_id as reader, p.club_id as club, p.chapter_index as chapter, p.user_id as author
    from public.club_members m
    join public.account_private a on a.user_id = m.user_id and a.club_post_emails
    join public.book_clubs b on b.id = m.club_id
    join public.club_posts p on p.club_id = m.club_id
    left join public.reading_progress r on r.user_id = m.user_id and r.volume_id = private.member_volume(b.volume_id, m.own_copy)
    where m.notify
      and p.user_id <> m.user_id
      and p.created_at > greatest(m.last_read_at, coalesce(a.club_posts_emailed_through, '-infinity'::timestamptz), now() - interval '7 days')
      and p.created_at <= v_until
      and (coalesce(r.finished, false) or p.chapter_index <= coalesce(r.chapter_index, 0))
  ), due as (
    select a.user_id as reader, a.club_posts_emailed_through as was
    from public.account_private a
    join auth.users u on u.id = a.user_id and u.email is not null and u.email_confirmed_at is not null
    where a.user_id in (select f.reader from fresh f)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update of a skip locked
  ), claimed as (
    update public.account_private a set club_posts_emailed_through = v_until
    from due where a.user_id = due.reader
    returning a.user_id as reader, due.was
  )
  select c.reader, u.email::text, me.display_name,
         f.club, b.name, b.volume_id,
         f.chapter, count(*), array_agg(distinct coalesce(w.display_name, 'A member') order by coalesce(w.display_name, 'A member')),
         c.was
  from claimed c
  join fresh f on f.reader = c.reader
  join auth.users u on u.id = c.reader
  join public.book_clubs b on b.id = f.club
  left join public.profiles me on me.id = c.reader
  left join public.profiles w on w.id = f.author
  group by c.reader, u.email, me.display_name, f.club, b.name, b.volume_id, f.chapter, c.was
  order by c.reader, b.name, f.chapter;
end;
$$;

create or replace function public.claim_club_post_pushes(max_count integer default 200)
returns table (user_id uuid, club_id uuid, club_name text, last_chapter smallint, posts bigint, authors text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_until timestamptz := now() - interval '1 minute';
begin
  return query
  with fresh as (
    select m.user_id as reader, p.club_id as club, p.chapter_index as chapter, p.user_id as author
    from public.club_members m
    join public.account_private a on a.user_id = m.user_id and 'club_posts' = any (a.push_kinds)
    join public.book_clubs b on b.id = m.club_id
    join public.club_posts p on p.club_id = m.club_id
    left join public.reading_progress r on r.user_id = m.user_id and r.volume_id = private.member_volume(b.volume_id, m.own_copy)
    where m.notify
      and p.user_id <> m.user_id
      and p.created_at > greatest(m.last_read_at, a.club_posts_pushed_through, now() - interval '1 day')
      and p.created_at <= v_until
      and (coalesce(r.finished, false) or p.chapter_index <= coalesce(r.chapter_index, 0))
      and exists (select 1 from public.push_subscriptions s where s.user_id = m.user_id)
  ), due as (
    select a.user_id as reader
    from public.account_private a
    where a.user_id in (select f.reader from fresh f)
    order by a.user_id
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update of a skip locked
  ), claimed as (
    update public.account_private a set club_posts_pushed_through = v_until
    from due where a.user_id = due.reader
    returning a.user_id as reader
  )
  select c.reader, f.club, b.name, max(f.chapter), count(*),
         array_agg(distinct coalesce(w.display_name, 'A member') order by coalesce(w.display_name, 'A member'))
  from claimed c
  join fresh f on f.reader = c.reader
  join public.book_clubs b on b.id = f.club
  left join public.profiles w on w.id = f.author
  group by c.reader, f.club, b.name
  order by c.reader, b.name;
end;
$$;

create or replace function private.club_highlights_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_highlight public.highlights%rowtype;
begin
  select * into v_highlight from public.highlights h where h.id = new.highlight_id and h.user_id = new.user_id;
  if not found then
    raise exception 'Share one of your own highlights' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.book_clubs c
    join public.club_members m on m.club_id = c.id and m.user_id = new.user_id
    where c.id = new.club_id and private.member_volume(c.volume_id, m.own_copy) = v_highlight.volume_id
  ) then
    raise exception 'Share a highlight from the club''s book' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.club_highlights x where x.club_id = new.club_id and x.user_id = new.user_id) >= 300 then
    raise exception 'You can share up to 300 highlights in a club' using errcode = 'check_violation';
  end if;
  new.chapter_index := v_highlight.chapter_index;
  new.quote := v_highlight.quote;
  new.color := v_highlight.color;
  new.note := case when new.share_note then v_highlight.note else null end;
  new.created_at := now();
  return new;
end;
$$;
