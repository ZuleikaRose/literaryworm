-- Reading sprints: a timed 15 to 30 minute session that a household's profiles or a book club's
-- members join. Everyone sees the same timer (from starts_at and ends_at) and, at the end, how many
-- pages each reader turned. Pages are counted in the reader on each device, never the text.
--
-- * reading_sprints: a household's (account_id) or a club's (club_id), one running at a time for
--   each, up to 20 a day. Started only through start_reading_sprint(), which also joins the starter.
-- * reading_sprint_readers: one row per profile that joined. Written only through
--   join_reading_sprint() and finish_reading_sprint(); read by whoever can see the sprint (for its
--   live updates). Names come from reading_sprint_names(), so a club never sees another member's
--   household profiles, only their display name.
-- Kept 90 days (pg_cron). Indexes for the foreign keys are in migrations 6650 to 6654.

create table public.reading_sprints (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid references public.book_clubs (id) on delete cascade,
  account_id  uuid references auth.users (id) on delete cascade,
  started_by  uuid not null references public.reader_profiles (id) on delete cascade,
  minutes     smallint not null check (minutes in (15, 20, 25, 30)),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  check ((club_id is null) <> (account_id is null)),
  check (ends_at > starts_at)
);

create table public.reading_sprint_readers (
  sprint_id   uuid not null references public.reading_sprints (id) on delete cascade,
  profile_id  uuid not null references public.reader_profiles (id) on delete cascade,
  account_id  uuid not null references auth.users (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  -- Pages turned forward in the reader during the sprint, saved when it ends (null until then).
  pages_read  smallint check (pages_read is null or pages_read between 0 and 2000),
  finished_at timestamptz,
  primary key (sprint_id, profile_id)
);

alter table public.reading_sprints enable row level security;
alter table public.reading_sprint_readers enable row level security;

create policy "Households and club members see their sprints" on public.reading_sprints for select to authenticated
  using (account_id = (select auth.uid()) or (club_id is not null and public.is_club_member(club_id)));
create policy "Two-step sign-in when turned on" on public.reading_sprints as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Visible to whoever can see the sprint (by reading_sprints' policy).
create policy "Readers of sprints you can see" on public.reading_sprint_readers for select to authenticated
  using (exists (select 1 from public.reading_sprints s where s.id = sprint_id));
create policy "Two-step sign-in when turned on" on public.reading_sprint_readers as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.reading_sprints, public.reading_sprint_readers from anon, authenticated;
grant select (id, club_id, account_id, started_by, minutes, starts_at, ends_at) on public.reading_sprints to authenticated;
grant select (sprint_id, profile_id, joined_at, pages_read, finished_at) on public.reading_sprint_readers to authenticated;
grant select, insert, update, delete on public.reading_sprints, public.reading_sprint_readers to service_role;

alter publication supabase_realtime add table public.reading_sprints;
alter publication supabase_realtime add table public.reading_sprint_readers;

-- The caller may use this profile here: it's theirs, in use, and (in a club) not a Kids profile.
create or replace function private.sprint_profile_ok(p_profile uuid, p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reader_profiles rp
    where rp.id = p_profile and rp.account_id = (select auth.uid()) and rp.set_aside_at is null
      and (p_club is null or rp.age_rating <> 'kids')
  );
$$;
revoke execute on function private.sprint_profile_ok(uuid, uuid) from public, anon, authenticated;

-- Starts a sprint for the caller's household (p_club null) or one of their clubs, and joins the
-- profile that started it. Refused while another is running there, or after 20 in a day.
create or replace function public.start_reading_sprint(p_club uuid, p_profile uuid, p_minutes smallint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id   uuid;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to start a sprint' using errcode = 'insufficient_privilege';
  end if;
  if p_minutes is null or p_minutes not in (15, 20, 25, 30) then
    raise exception 'A sprint lasts 15, 20, 25 or 30 minutes' using errcode = 'check_violation';
  end if;
  if p_club is not null and not exists (select 1 from public.club_members cm where cm.club_id = p_club and cm.user_id = v_user) then
    raise exception 'Only the club''s members can start a sprint' using errcode = 'insufficient_privilege';
  end if;
  if not private.sprint_profile_ok(p_profile, p_club) then
    raise exception 'Choose one of your profiles' using errcode = 'insufficient_privilege';
  end if;
  -- One at a time for each household or club: two people starting at once wait for each other here.
  perform pg_advisory_xact_lock(hashtextextended('reading-sprint:' || coalesce(p_club, v_user)::text, 0));
  if exists (
    select 1 from public.reading_sprints s
    where (case when p_club is null then s.account_id = v_user else s.club_id = p_club end) and s.ends_at > now()
  ) then
    raise exception 'A sprint is already running here' using errcode = 'check_violation';
  end if;
  if (
    select count(*) from public.reading_sprints s
    where (case when p_club is null then s.account_id = v_user else s.club_id = p_club end) and s.starts_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'That''s 20 sprints today. Try again tomorrow' using errcode = 'check_violation';
  end if;
  insert into public.reading_sprints (club_id, account_id, started_by, minutes, starts_at, ends_at)
  values (p_club, case when p_club is null then v_user end, p_profile, p_minutes, now(), now() + make_interval(mins => p_minutes))
  returning id into v_id;
  insert into public.reading_sprint_readers (sprint_id, profile_id, account_id) values (v_id, p_profile, v_user);
  return v_id;
end;
$$;
revoke execute on function public.start_reading_sprint(uuid, uuid, smallint) from public, anon;
grant execute on function public.start_reading_sprint(uuid, uuid, smallint) to authenticated, service_role;

-- Joins a running sprint the caller can see, as one of their profiles (joining twice is fine).
create or replace function public.join_reading_sprint(p_sprint uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  s      public.reading_sprints;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to join the sprint' using errcode = 'insufficient_privilege';
  end if;
  select * into s from public.reading_sprints where id = p_sprint;
  if s.id is null
     or (s.account_id is not null and s.account_id <> v_user)
     or (s.club_id is not null and not exists (select 1 from public.club_members cm where cm.club_id = s.club_id and cm.user_id = v_user)) then
    raise exception 'That sprint isn''t yours to join' using errcode = 'insufficient_privilege';
  end if;
  if s.ends_at <= now() then
    raise exception 'This sprint has ended' using errcode = 'check_violation';
  end if;
  if not private.sprint_profile_ok(p_profile, s.club_id) then
    raise exception 'Choose one of your profiles' using errcode = 'insufficient_privilege';
  end if;
  insert into public.reading_sprint_readers (sprint_id, profile_id, account_id)
  values (p_sprint, p_profile, v_user)
  on conflict (sprint_id, profile_id) do nothing;
end;
$$;
revoke execute on function public.join_reading_sprint(uuid, uuid) from public, anon;
grant execute on function public.join_reading_sprint(uuid, uuid) to authenticated, service_role;

-- Saves the pages a profile read in a sprint it joined: any time from joining until two hours
-- after it ends (saving again replaces the count).
create or replace function public.finish_reading_sprint(p_sprint uuid, p_profile uuid, p_pages integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_ends timestamptz;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to save your pages' using errcode = 'insufficient_privilege';
  end if;
  if p_pages is null or p_pages < 0 or p_pages > 2000 then
    raise exception 'Pages read are 0 to 2,000' using errcode = 'check_violation';
  end if;
  select s.ends_at into v_ends from public.reading_sprints s where s.id = p_sprint;
  if v_ends is null or v_ends < now() - interval '2 hours' then
    raise exception 'This sprint can''t be changed now' using errcode = 'check_violation';
  end if;
  update public.reading_sprint_readers
  set pages_read = p_pages, finished_at = now()
  where sprint_id = p_sprint and profile_id = p_profile and account_id = v_user;
  if not found then
    raise exception 'Join the sprint first' using errcode = 'insufficient_privilege';
  end if;
end;
$$;
revoke execute on function public.finish_reading_sprint(uuid, uuid, integer) from public, anon;
grant execute on function public.finish_reading_sprint(uuid, uuid, integer) to authenticated, service_role;

-- Who's in a sprint the caller can see, with the name to show: a household sees its profiles'
-- names; a club sees each member's display name (never which of their profiles).
create or replace function public.reading_sprint_names(p_sprint uuid)
returns table (profile_id uuid, name text, pages_read smallint, finished boolean, mine boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  s      public.reading_sprints;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to see the sprint' using errcode = 'insufficient_privilege';
  end if;
  select * into s from public.reading_sprints where id = p_sprint;
  if s.id is null
     or (s.account_id is not null and s.account_id <> v_user)
     or (s.club_id is not null and not exists (select 1 from public.club_members cm where cm.club_id = s.club_id and cm.user_id = v_user)) then
    raise exception 'That sprint isn''t yours to see' using errcode = 'insufficient_privilege';
  end if;
  return query
    select r.profile_id,
           case when s.club_id is null then rp.name else coalesce(p.display_name, 'A member') end,
           r.pages_read, r.finished_at is not null, r.account_id = v_user
    from public.reading_sprint_readers r
    join public.reader_profiles rp on rp.id = r.profile_id
    left join public.profiles p on p.id = r.account_id
    where r.sprint_id = p_sprint
    order by r.pages_read desc nulls last, r.joined_at;
end;
$$;
revoke execute on function public.reading_sprint_names(uuid) from public, anon;
grant execute on function public.reading_sprint_names(uuid) to authenticated, service_role;

select cron.schedule('reading-sprints-cleanup', '50 3 * * *', $$delete from public.reading_sprints where ends_at < now() - interval '90 days'$$);
