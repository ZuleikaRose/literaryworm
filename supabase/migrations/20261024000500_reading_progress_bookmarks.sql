-- Reading progress and bookmarks (Phase 7: the reader and the audiobook player).
--
-- Both are private to the account, like library_items, and belong to a book in
-- the account's library: a composite foreign key to library_items(user_id,
-- volume_id) enforces it, and removing the book deletes its progress and
-- bookmarks (on delete cascade). Opening a book in the reader or player adds it
-- to the library as "reading" first.

create type public.book_format as enum ('ebook', 'audiobook');

-- Where the account stopped in each book: one row per book, for Continue Reading.
create table public.reading_progress (
  user_id       uuid not null,
  volume_id     text not null,
  -- The format last used, so Continue Reading reopens the reader or the player.
  format        public.book_format not null,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  -- How far through the whole book, 0 to 1 (pages for ebooks, time for audiobooks).
  position      numeric(5, 4) not null check (position between 0 and 1),
  finished      boolean not null default false,
  updated_at    timestamptz not null default now(),
  -- Also the index for the foreign key and for RLS (user_id first).
  primary key (user_id, volume_id),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);

create trigger reading_progress_set_updated_at
  before update on public.reading_progress
  for each row execute function public.set_updated_at();

alter table public.reading_progress enable row level security;

create policy "Readers see their own progress"
  on public.reading_progress for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers save their own progress"
  on public.reading_progress for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers update their own progress"
  on public.reading_progress for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers clear their own progress"
  on public.reading_progress for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.reading_progress from anon, authenticated;
grant select, delete on public.reading_progress to authenticated;
grant insert (user_id, volume_id, format, chapter_index, position, finished) on public.reading_progress to authenticated;
grant update (format, chapter_index, position, finished) on public.reading_progress to authenticated;


-- Bookmarks: a named place in a book, in either format.
create table public.bookmarks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  volume_id     text not null,
  format        public.book_format not null,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  position      numeric(5, 4) not null check (position between 0 and 1),
  label         text not null check (char_length(btrim(label)) between 1 and 120),
  created_at    timestamptz not null default now(),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);
-- The foreign key's index (user_id, volume_id) is in the 0501 migration.

alter table public.bookmarks enable row level security;

create policy "Readers see their own bookmarks"
  on public.bookmarks for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add their own bookmarks"
  on public.bookmarks for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers remove their own bookmarks"
  on public.bookmarks for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Bookmarks are added and removed, never edited.
revoke all on public.bookmarks from anon, authenticated;
grant select, delete on public.bookmarks to authenticated;
grant insert (user_id, volume_id, format, chapter_index, position, label) on public.bookmarks to authenticated;
