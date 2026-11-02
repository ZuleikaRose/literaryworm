-- Club polls: a book club's owner offers 2 to 5 LiteraryWorm titles and members vote on what to
-- read next. Everyone in the club sees the votes (like meeting RSVPs); the owner closes the poll,
-- which keeps the winner (most votes; a tie goes to the book offered first).
--
-- * club_polls: one open poll per club at a time, up to 50 a club in all. The owner starts and
--   deletes them; nobody updates a poll directly: close_club_poll() closes it.
-- * club_poll_votes: one vote per member per poll. Members read their clubs' votes; nobody writes
--   the table directly: votes go through vote_club_poll(), which checks the voter is in the club,
--   the poll is open and the choice is one of its books.
-- Indexes for the foreign keys are in migrations 6638 to 6640.

create table public.club_polls (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.book_clubs (id) on delete cascade,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  question    text not null default 'What should we read next?' check (char_length(btrim(question)) between 1 and 120),
  -- LiteraryWorm catalog ids, in the order offered; distinct (checked by the trigger below).
  options     text[] not null check (cardinality(options) between 2 and 5 and array_position(options, null) is null),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  -- The book that won, set by close_club_poll() (one of options).
  winner      text check (winner is null or winner ~ '^[A-Za-z0-9_-]{1,40}$'),
  check ((closed_at is null) = (winner is null))
);

-- One open poll per club.
create unique index club_polls_one_open on public.club_polls (club_id) where closed_at is null;

create table public.club_poll_votes (
  poll_id  uuid not null references public.club_polls (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  -- 0-based: which of the poll's options.
  choice   smallint not null check (choice between 0 and 4),
  voted_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- A new poll: started by the club's owner as themselves, books distinct and well-formed, at most
-- 50 a club. Runs as the caller, so the owner check sees only what they may see.
create or replace function private.check_club_poll()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  new.question := btrim(new.question);
  if not exists (select 1 from public.book_clubs b where b.id = new.club_id and b.owner_id = new.created_by) then
    raise exception 'Only the club''s owner can start a poll' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from unnest(new.options) o where o !~ '^[A-Za-z0-9_-]{1,40}$')
     or (select count(distinct o) from unnest(new.options) o) <> cardinality(new.options) then
    raise exception 'A poll offers 2 to 5 different books' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.club_polls p where p.club_id = new.club_id) >= 50 then
    raise exception 'A club can have up to 50 polls' using errcode = 'check_violation';
  end if;
  new.closed_at := null;
  new.winner := null;
  return new;
end;
$$;

revoke execute on function private.check_club_poll() from public, anon, authenticated;

create trigger club_polls_check
  before insert on public.club_polls
  for each row execute function private.check_club_poll();

alter table public.club_polls enable row level security;
alter table public.club_poll_votes enable row level security;

create policy "Members see their clubs' polls" on public.club_polls for select to authenticated
  using (public.is_club_member(club_id));
create policy "Owners start polls in their clubs" on public.club_polls for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.book_clubs b where b.id = club_id and b.owner_id = (select auth.uid()))
  );
create policy "Owners delete their clubs' polls" on public.club_polls for delete to authenticated
  using (exists (select 1 from public.book_clubs b where b.id = club_id and b.owner_id = (select auth.uid())));
create policy "Two-step sign-in when turned on" on public.club_polls as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- Visible to whoever can see the poll (its club's members, by club_polls' policy).
create policy "Members see votes in their clubs' polls" on public.club_poll_votes for select to authenticated
  using (exists (select 1 from public.club_polls p where p.id = poll_id));
create policy "Two-step sign-in when turned on" on public.club_poll_votes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.club_polls, public.club_poll_votes from anon, authenticated;
grant select (id, club_id, created_by, question, options, created_at, closed_at, winner), delete on public.club_polls to authenticated;
grant insert (id, club_id, created_by, question, options) on public.club_polls to authenticated;
grant select (poll_id, user_id, choice, voted_at) on public.club_poll_votes to authenticated;
grant select, insert, update, delete on public.club_polls, public.club_poll_votes to service_role;

-- Votes for the signed-in member: a choice (0-based), or null to take the vote back.
create or replace function public.vote_club_poll(p_poll uuid, p_choice smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_club    uuid;
  v_closed  timestamptz;
  v_options integer;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to vote' using errcode = 'insufficient_privilege';
  end if;
  select p.club_id, p.closed_at, cardinality(p.options) into v_club, v_closed, v_options from public.club_polls p where p.id = p_poll;
  if v_club is null or not exists (select 1 from public.club_members cm where cm.club_id = v_club and cm.user_id = v_user) then
    raise exception 'Only the club''s members can vote' using errcode = 'insufficient_privilege';
  end if;
  if v_closed is not null then
    raise exception 'This poll has closed' using errcode = 'check_violation';
  end if;
  if p_choice is null then
    delete from public.club_poll_votes where poll_id = p_poll and user_id = v_user;
  elsif p_choice < 0 or p_choice >= v_options then
    raise exception 'Choose one of the poll''s books' using errcode = 'check_violation';
  else
    insert into public.club_poll_votes (poll_id, user_id, choice)
    values (p_poll, v_user, p_choice)
    on conflict (poll_id, user_id) do update set choice = excluded.choice, voted_at = now();
  end if;
end;
$$;
revoke execute on function public.vote_club_poll(uuid, smallint) from public, anon;
grant execute on function public.vote_club_poll(uuid, smallint) to authenticated, service_role;

-- Closes an open poll for the club's owner and returns the winner: the book with the most votes,
-- a tie going to the one offered first (the first book when nobody voted).
create or replace function public.close_club_poll(p_poll uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_club    uuid;
  v_closed  timestamptz;
  v_options text[];
  v_choice  smallint;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to close the poll' using errcode = 'insufficient_privilege';
  end if;
  select p.club_id, p.closed_at, p.options into v_club, v_closed, v_options from public.club_polls p where p.id = p_poll for update;
  if v_club is null or not exists (select 1 from public.book_clubs b where b.id = v_club and b.owner_id = v_user) then
    raise exception 'Only the club''s owner can close the poll' using errcode = 'insufficient_privilege';
  end if;
  if v_closed is not null then
    raise exception 'This poll has already closed' using errcode = 'check_violation';
  end if;
  select coalesce((
    select v.choice from public.club_poll_votes v where v.poll_id = p_poll
    group by v.choice order by count(*) desc, v.choice asc limit 1
  ), 0) into v_choice;
  update public.club_polls set closed_at = now(), winner = v_options[v_choice + 1] where id = p_poll;
  return v_options[v_choice + 1];
end;
$$;
revoke execute on function public.close_club_poll(uuid) from public, anon;
grant execute on function public.close_club_poll(uuid) to authenticated, service_role;
