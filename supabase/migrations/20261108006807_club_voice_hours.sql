-- Club listening hours: the owner of a club reading an uploaded book can give each member up to
-- 30, 60, 120 or 180 minutes a month of natural-voice reading for their own copy of it, taken
-- from the owner's own month (book_clubs.voice_minutes_per_member, changed under the existing
-- "Owners change their clubs" policy). The natural-voice function uses it only when the member's
-- own hours are used up: club_voice_source() finds a club with room, the owner's allowance is
-- claimed with claim_natural_voice(), and record_club_voice() counts it per member and month
-- (club_voice_usage). Members read their own row; the function writes.

alter table public.book_clubs
  add column if not exists voice_minutes_per_member smallint check (voice_minutes_per_member in (30, 60, 120, 180));
grant update (voice_minutes_per_member) on public.book_clubs to authenticated;
comment on column public.book_clubs.voice_minutes_per_member is
  'Natural-voice minutes a month the owner gives each member for their own copy of the club''s uploaded book; null for none.';

create table if not exists public.club_voice_usage (
  club_id    uuid not null references public.book_clubs (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  month      date not null check (extract(day from month) = 1),
  characters integer not null default 0 check (characters >= 0),
  primary key (club_id, user_id, month)
);
comment on table public.club_voice_usage is
  'Natural-voice reading a member used from their club owner''s gift, per month. Written only by the natural-voice function.';
alter table public.club_voice_usage enable row level security;
revoke all on public.club_voice_usage from anon, authenticated;
grant select on public.club_voice_usage to authenticated;
grant select, insert, update, delete on public.club_voice_usage to service_role;
create policy "Members read their own club voice use" on public.club_voice_usage
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Two-step sign-in for club voice use" on public.club_voice_usage
  as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

-- A club, its owner and its gift where p_member (not the owner) reads p_upload as their own copy
-- of the club's uploaded book and has room this month for p_characters; null when none.
create or replace function public.club_voice_source(p_member uuid, p_upload text, p_characters integer)
returns table (club_id uuid, owner_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.owner_id
  from public.book_clubs c
  join public.club_members m on m.club_id = c.id and m.user_id = p_member
  left join public.club_voice_usage u
    on u.club_id = c.id and u.user_id = p_member and u.month = date_trunc('month', now() at time zone 'utc')::date
  where c.volume_id ~ '^u-[0-9a-f]{32}$'
    and c.owner_id <> p_member
    and m.own_copy = p_upload
    and c.voice_minutes_per_member is not null
    and coalesce(u.characters, 0) + p_characters <= c.voice_minutes_per_member * 840
  order by c.voice_minutes_per_member desc, c.id
  limit 1;
$$;

-- Adds (or, after Google failed, takes back) a member's use of a club's gift this month.
create or replace function public.record_club_voice(p_club uuid, p_member uuid, p_characters integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.club_voice_usage (club_id, user_id, month, characters)
  values (p_club, p_member, date_trunc('month', now() at time zone 'utc')::date, greatest(0, p_characters))
  on conflict (club_id, user_id, month) do update
    set characters = greatest(0, public.club_voice_usage.characters + p_characters);
$$;

revoke execute on function public.club_voice_source(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.record_club_voice(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.club_voice_source(uuid, text, integer) to service_role;
grant execute on function public.record_club_voice(uuid, uuid, integer) to service_role;

-- Kept a year, like the other monthly usage.
select cron.schedule(
  'club-voice-usage-cleanup',
  '17 4 2 * *',
  $cron$delete from public.club_voice_usage where month < (date_trunc('month', now()) - interval '12 months')::date$cron$
);
