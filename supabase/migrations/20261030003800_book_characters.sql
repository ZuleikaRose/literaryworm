-- Who's who (new request): for a public-domain title, the characters a reader has met up to
-- a chapter, each described only from the text so far. The `characters` Edge Function asks
-- Claude for a book's list at a chapter the first time anyone needs it and keeps it here, so
-- every later reader at that chapter gets the same list.
--
-- Only the function (service_role) reads and writes these rows; browser roles have no access
-- at all and go through the function. Nothing here is about any member.

create table public.book_characters (
  volume_id     text        not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- 0-based, like the reader's chapter index.
  chapter_index smallint    not null check (chapter_index between 0 and 999),
  -- [{ name, description, firstChapter }], checked by the function before it's kept.
  characters    jsonb       not null check (jsonb_typeof(characters) = 'array' and jsonb_array_length(characters) between 1 and 40),
  -- The Claude model that wrote it, so lists can be rewritten when the model changes.
  model         text        not null check (char_length(model) between 1 and 80),
  created_at    timestamptz not null default now(),
  primary key (volume_id, chapter_index)
);

alter table public.book_characters enable row level security;
revoke all on public.book_characters from public, anon, authenticated;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch it.
create policy "No browser access to who's who"
  on public.book_characters as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);
