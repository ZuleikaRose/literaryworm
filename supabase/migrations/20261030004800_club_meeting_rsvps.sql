-- Club meeting RSVPs (follow-up to the book club calendar): each member answers a meeting with
-- Going, Maybe or Can't make it, and everyone in the club sees who's coming. Members who can't
-- make it don't get the day-before reminder email.
--
-- * club_meeting_rsvps: one answer per member per meeting. Members read their clubs' answers
--   (through club_meetings' own RLS); nobody writes the table directly: answers go through
--   answer_club_meeting(), which checks the meeting is the caller's club's and still to come.
-- * claim_club_meeting_reminders() now skips members who answered no.

create table public.club_meeting_rsvps (
  meeting_id  uuid not null references public.club_meetings (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  answer      text not null check (answer in ('yes', 'maybe', 'no')),
  answered_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
-- The index for user_id (a foreign key) is in the 4801 migration; meeting_id leads the primary key.

alter table public.club_meeting_rsvps enable row level security;

-- Visible to whoever can see the meeting (its club's members, by club_meetings' policy).
create policy "Members see answers to their clubs' meetings" on public.club_meeting_rsvps for select to authenticated
  using (exists (select 1 from public.club_meetings m where m.id = meeting_id));
create policy "Two-step sign-in when turned on" on public.club_meeting_rsvps as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.club_meeting_rsvps from anon, authenticated;
grant select (meeting_id, user_id, answer, answered_at) on public.club_meeting_rsvps to authenticated;

-- Answers a meeting for the signed-in member: 'yes', 'maybe' or 'no', or null to take the answer back.
create or replace function public.answer_club_meeting(p_meeting uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_club  uuid;
  v_start timestamptz;
begin
  if v_user is null or not public.second_step_done() then
    raise exception 'Sign in to answer' using errcode = 'insufficient_privilege';
  end if;
  if p_answer is not null and p_answer not in ('yes', 'maybe', 'no') then
    raise exception 'Answer yes, maybe or no' using errcode = 'check_violation';
  end if;
  select m.club_id, m.starts_at into v_club, v_start from public.club_meetings m where m.id = p_meeting;
  if v_club is null or not exists (select 1 from public.club_members cm where cm.club_id = v_club and cm.user_id = v_user) then
    raise exception 'Only the club''s members can answer' using errcode = 'insufficient_privilege';
  end if;
  if v_start <= now() then
    raise exception 'This meeting has already started' using errcode = 'check_violation';
  end if;
  if p_answer is null then
    delete from public.club_meeting_rsvps where meeting_id = p_meeting and user_id = v_user;
  else
    insert into public.club_meeting_rsvps (meeting_id, user_id, answer)
    values (p_meeting, v_user, p_answer)
    on conflict (meeting_id, user_id) do update set answer = excluded.answer, answered_at = now();
  end if;
end;
$$;
revoke execute on function public.answer_club_meeting(uuid, text) from public, anon;
grant execute on function public.answer_club_meeting(uuid, text) to authenticated;

create or replace function public.claim_club_meeting_reminders(max_count integer default 100)
returns table (
  meeting_id uuid, club_id uuid, club_name text, volume_id text, title text, note text,
  starts_at timestamptz, minutes smallint, time_zone text,
  user_id uuid, email text, member_name text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select m.id
    from public.club_meetings m
    where m.reminded_at is null
      and m.starts_at > now() + interval '1 hour'
      and m.starts_at <= now() + interval '24 hours'
    order by m.starts_at
    limit least(greatest(coalesce(max_count, 100), 1), 500)
    for update skip locked
  ), claimed as (
    update public.club_meetings m set reminded_at = now()
    from due where m.id = due.id
    returning m.id, m.club_id, m.title, m.note, m.starts_at, m.minutes, m.time_zone
  )
  select c.id, c.club_id, b.name, b.volume_id, c.title, c.note, c.starts_at, c.minutes, c.time_zone,
         cm.user_id, u.email::text, p.display_name
  from claimed c
  join public.book_clubs b on b.id = c.club_id
  join public.club_members cm on cm.club_id = c.club_id
  join auth.users u on u.id = cm.user_id and u.email is not null and u.email_confirmed_at is not null
  join public.account_private a on a.user_id = cm.user_id and a.club_meeting_emails
  left join public.profiles p on p.id = cm.user_id
  -- Members who said they can't come aren't reminded.
  where not exists (
    select 1 from public.club_meeting_rsvps r
    where r.meeting_id = c.id and r.user_id = cm.user_id and r.answer = 'no'
  );
end;
$$;
revoke execute on function public.claim_club_meeting_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_club_meeting_reminders(integer) to service_role;
