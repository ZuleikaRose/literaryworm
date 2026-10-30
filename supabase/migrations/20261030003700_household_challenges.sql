-- Household reading challenges (new request): a goal for a stretch of time that the
-- profiles of one account take on together, such as "5 books in November", "20 hours
-- this month" or "25 days with reading". Any profile starts one; any profile (Kids
-- included) joins or leaves; everyone in the household sees each other's progress, which
-- the app works out from each profile's reading_days. Nothing is shared outside the
-- account.
--
-- * household_challenges: the challenge, owned by the account (user_id). created_by is the
--   profile that started it, and is cleared (the challenge stays) if that profile goes.
--   Up to 20 an account (trigger). Not edited once made; deleted when done with.
-- * challenge_participants: which profiles joined. The composite keys make sure the
--   challenge and the profile belong to the same account.

create table public.household_challenges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_by uuid,
  title      text not null check (char_length(title) between 1 and 80 and title = btrim(title)),
  kind       text not null check (kind in ('books', 'hours', 'days')),
  target     smallint not null check (target between 1 and 1000),
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 366),
  check (kind <> 'days' or target <= ends_on - starts_on + 1),
  unique (id, user_id),
  foreign key (created_by, user_id) references public.reader_profiles (id, account_id) on delete set null (created_by)
);

create table public.challenge_participants (
  challenge_id uuid not null,
  user_id      uuid not null,
  profile_id   uuid not null,
  joined_at    timestamptz not null default now(),
  -- Leads with (challenge_id, user_id), so it also indexes that foreign key.
  primary key (challenge_id, user_id, profile_id),
  foreign key (challenge_id, user_id) references public.household_challenges (id, user_id) on delete cascade,
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_challenge_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.household_challenges where user_id = new.user_id) >= 20 then
    raise exception 'A household can have up to 20 challenges' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_challenge_limit() from public, anon, authenticated;

create trigger household_challenges_limit
  before insert on public.household_challenges
  for each row execute function private.enforce_challenge_limit();

alter table public.household_challenges enable row level security;
alter table public.challenge_participants enable row level security;

create policy "Households see their challenges" on public.household_challenges for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Households start challenges" on public.household_challenges for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Households delete their challenges" on public.household_challenges for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.household_challenges as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

create policy "Households see who joined" on public.challenge_participants for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Profiles join challenges" on public.challenge_participants for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Profiles leave challenges" on public.challenge_participants for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.challenge_participants as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.household_challenges, public.challenge_participants from anon, authenticated;
grant select, delete on public.household_challenges, public.challenge_participants to authenticated;
grant insert (user_id, created_by, title, kind, target, starts_on, ends_on) on public.household_challenges to authenticated;
grant insert (challenge_id, user_id, profile_id) on public.challenge_participants to authenticated;
