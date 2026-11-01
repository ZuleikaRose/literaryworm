-- Reading plans (lib/readingPlans.ts): "finish this book by a date", per profile and book. The
-- app works out the pages and minutes a day from the reader's place and pace; the table keeps only
-- the date, where the reader was when the plan started (0–1) and that day, so ahead or behind can
-- be shown. Private to the account. Up to 20 per profile, at most two years ahead (trigger). The
-- primary key covers the profile foreign key; user_id gets its own index (RLS) in the next
-- migration.

create table public.reading_plans (
  profile_id     uuid not null,
  user_id        uuid not null,
  volume_id      text not null check (char_length(volume_id) between 1 and 64),
  finish_by      date not null,
  start_fraction numeric(5, 4) not null default 0 check (start_fraction between 0 and 1),
  started_on     date not null default current_date,
  created_at     timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.reading_plans_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The browser sends its own day; allow a day either side of the server's for time zones.
  if new.finish_by < current_date - 1 or new.finish_by > current_date + 731 then
    raise exception 'Choose a day from today to two years ahead' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.reading_plans p where p.profile_id = new.profile_id and p.user_id = new.user_id) >= 20 then
      raise exception 'A profile can have up to 20 reading plans' using errcode = 'check_violation';
    end if;
    if new.started_on not between current_date - 1 and current_date + 1 then
      raise exception 'A plan starts today' using errcode = 'check_violation';
    end if;
    new.created_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function private.reading_plans_guard() from public, anon, authenticated;

create trigger reading_plans_guard
  before insert or update on public.reading_plans
  for each row execute function private.reading_plans_guard();

alter table public.reading_plans enable row level security;

create policy "Readers see their own plans" on public.reading_plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers make their own plans" on public.reading_plans for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers change their own plans" on public.reading_plans for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers remove their own plans" on public.reading_plans for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.reading_plans as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.reading_plans from anon, authenticated;
grant select, delete on public.reading_plans to authenticated;
grant insert (profile_id, user_id, volume_id, finish_by, start_fraction, started_on) on public.reading_plans to authenticated;
grant update (finish_by, start_fraction, started_on) on public.reading_plans to authenticated;
