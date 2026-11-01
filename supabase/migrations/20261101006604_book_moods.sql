-- Moods and pace: how a book felt to one profile (StoryGraph's 14 moods and three paces, so the
-- export lines up; src/lib/moods.ts has the same lists). Per profile, like book_ratings: every row
-- carries the account for RLS and a composite foreign key to reader_profiles(id, account_id), and
-- the primary key starts with (profile_id, user_id), so it also indexes that foreign key. Up to
-- three moods a book; a row with nothing tagged is deleted by the browser instead of kept.

create table public.book_moods (
  profile_id uuid not null,
  user_id    uuid not null,
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  moods      text[] not null default '{}'
    check (cardinality(moods) <= 3
       and moods <@ array['adventurous', 'challenging', 'dark', 'emotional', 'funny', 'hopeful', 'informative',
                          'inspiring', 'lighthearted', 'mysterious', 'reflective', 'relaxing', 'sad', 'tense']::text[]),
  pace       text check (pace in ('slow', 'medium', 'fast')),
  updated_at timestamptz not null default now(),
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade,
  check (cardinality(moods) > 0 or pace is not null)
);

create trigger book_moods_set_updated_at
  before update on public.book_moods
  for each row execute function public.set_updated_at();

alter table public.book_moods enable row level security;

create policy "Readers see their own moods" on public.book_moods for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers tag moods as themselves" on public.book_moods for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers change their own moods" on public.book_moods for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers clear their own moods" on public.book_moods for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.book_moods as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.book_moods from anon, authenticated;
grant select, delete on public.book_moods to authenticated;
grant insert (profile_id, user_id, volume_id, moods, pace) on public.book_moods to authenticated;
grant update (moods, pace) on public.book_moods to authenticated;
