-- X-Ray (Who's who, places and terms): for a public-domain title, the people, places and terms
-- a reader has met up to a chapter, each described only from the text so far. The `xray` Edge
-- Function asks Claude for a book's X-Ray at a chapter the first time anyone needs it, checks
-- every name against the book's own text, and keeps it here, so every later reader at that
-- chapter gets the same one. The sibling of book_characters (Who's who, migration 3800).
--
-- Only the function (service_role) reads and writes these rows; browser roles have no access
-- at all and go through the function. Nothing here is about any member, and no book text is
-- kept: names, aliases, short descriptions and the chapter each is first named in.

create table public.book_xray (
  volume_id     text        not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- 0-based, like the reader's chapter index.
  chapter_index smallint    not null check (chapter_index between 0 and 999),
  -- Each [{ name, description, firstChapter, aliases }], checked by the function before it's kept.
  people        jsonb       not null check (jsonb_typeof(people) = 'array' and jsonb_array_length(people) <= 40),
  places        jsonb       not null check (jsonb_typeof(places) = 'array' and jsonb_array_length(places) <= 25),
  terms         jsonb       not null check (jsonb_typeof(terms) = 'array' and jsonb_array_length(terms) <= 25),
  -- The Claude model that wrote it, so X-Rays can be rewritten when the model changes.
  model         text        not null check (char_length(model) between 1 and 80),
  created_at    timestamptz not null default now(),
  primary key (volume_id, chapter_index),
  check (jsonb_array_length(people) + jsonb_array_length(places) + jsonb_array_length(terms) > 0)
);

alter table public.book_xray enable row level security;
revoke all on public.book_xray from public, anon, authenticated;
-- Newer branches don't grant service_role by default (see migration 6636).
grant select, insert on public.book_xray to service_role;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch it.
create policy "No browser access to X-Ray"
  on public.book_xray as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);
