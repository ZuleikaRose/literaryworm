-- Highlights and notes (Phase 9: the reader's study tools).
--
-- A highlight marks a passage on one page of the ebook reader, in one of four
-- colours, and may carry a note. Like bookmarks they are private to the account
-- and belong to a book in its library: the composite foreign key to
-- library_items(user_id, volume_id) enforces it, and removing the book deletes
-- its highlights (on delete cascade).
--
-- The passage is found again by its page (chapter and page within the chapter)
-- and its character offsets in that page's text; `quote` keeps the words
-- themselves so the highlights list can show them without opening each page.

create type public.highlight_color as enum ('yellow', 'green', 'blue', 'pink');

create table public.highlights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  volume_id     text not null,
  chapter_index smallint not null check (chapter_index between 0 and 999),
  -- 0-based page within the chapter.
  page          smallint not null check (page between 0 and 999),
  -- Character offsets in the page's text (paragraphs joined by a line break).
  start_offset  integer not null check (start_offset between 0 and 20000),
  end_offset    integer not null check (end_offset > start_offset and end_offset - start_offset <= 2000),
  quote         text not null check (char_length(btrim(quote)) between 1 and 2000),
  color         public.highlight_color not null default 'yellow',
  -- A note is optional; when present it can't be blank.
  note          text check (note is null or char_length(btrim(note)) between 1 and 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (user_id, volume_id)
    references public.library_items (user_id, volume_id) on delete cascade
);
-- The foreign key's index (user_id, volume_id) is in the 0701 migration.

create trigger highlights_set_updated_at
  before update on public.highlights
  for each row execute function public.set_updated_at();

alter table public.highlights enable row level security;

create policy "Readers see their own highlights"
  on public.highlights for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add their own highlights"
  on public.highlights for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers edit their own highlights"
  on public.highlights for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Readers remove their own highlights"
  on public.highlights for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- The passage is fixed once highlighted; only the colour and the note change.
revoke all on public.highlights from anon, authenticated;
grant select, delete on public.highlights to authenticated;
grant insert (user_id, volume_id, chapter_index, page, start_offset, end_offset, quote, color, note) on public.highlights to authenticated;
grant update (color, note) on public.highlights to authenticated;
