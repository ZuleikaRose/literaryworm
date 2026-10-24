-- The brief's library and logs.
--
-- Design problem: libraries are private, but logs are public on a book's page.
-- library_items has owner-only policies. logs has its own public read policy
-- and carries just enough to show a log (book id, author's display name, date),
-- so listing every log for a book never reads anyone's library.
-- A log can exist only for a book in its author's library: a composite foreign
-- key to library_items(user_id, volume_id) enforces it, and removing the book
-- deletes its logs (on delete cascade).

create type public.reading_status as enum ('want_to_read', 'reading', 'finished');

create table public.library_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Google Books volume id, checked against the format the API uses.
  volume_id  text not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  status     public.reading_status not null default 'want_to_read',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Also the index for user_id (RLS) and the target of logs' foreign key.
  unique (user_id, volume_id)
);

create trigger library_items_set_updated_at
  before update on public.library_items
  for each row execute function public.set_updated_at();

alter table public.library_items enable row level security;

create policy "Readers see their own library"
  on public.library_items for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add to their own library"
  on public.library_items for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers change status in their own library"
  on public.library_items for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers remove books from their own library"
  on public.library_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.library_items from anon, authenticated;
grant select, delete on public.library_items to authenticated;
grant insert (user_id, volume_id, status) on public.library_items to authenticated;
grant update (status) on public.library_items to authenticated;


create table public.logs (
  id         uuid primary key default gen_random_uuid(),
  -- References profiles so the book page can embed the display name.
  user_id    uuid not null references public.profiles (id) on delete cascade,
  volume_id  text not null,
  body       text not null check (char_length(btrim(body)) between 1 and 5000),
  rating     smallint check (rating between 1 and 5),   -- optional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);
-- Indexes for the book page (volume_id, newest first) and the foreign key
-- (user_id, volume_id) are in the 0401/0402 migrations.

create trigger logs_set_updated_at
  before update on public.logs
  for each row execute function public.set_updated_at();

alter table public.logs enable row level security;

create policy "Logs are public"
  on public.logs for select
  to anon, authenticated
  using (true);

-- The foreign key does the "book is in my library" check; the policy makes
-- sure the library is the writer's own.
create policy "Readers write their own logs"
  on public.logs for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers edit their own logs"
  on public.logs for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers delete their own logs"
  on public.logs for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.logs from anon, authenticated;
grant select on public.logs to anon, authenticated;
grant insert (user_id, volume_id, body, rating) on public.logs to authenticated;
grant update (body, rating) on public.logs to authenticated;
grant delete on public.logs to authenticated;
