-- Chapter recaps ("Previously…" in the player): for a public-domain title, what has happened in
-- the chapters before the one a listener has reached, written only from that text, so it can't
-- spoil anything. The `recaps` Edge Function asks Claude the first time anyone needs a book's
-- recap before a chapter and keeps it here, so every later listener there gets the same one.
--
-- Only the function (service_role) reads and writes these rows; browser roles have no access
-- at all and go through the function. Nothing here is about any member.

create table public.chapter_recaps (
  volume_id     text        not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- 0-based: the chapter the listener is starting; the recap covers the chapters before it.
  chapter_index smallint    not null check (chapter_index between 1 and 999),
  -- The story so far, and the chapter just before, in plain prose.
  so_far        text        not null check (char_length(so_far) between 1 and 1500),
  last_chapter  text        not null check (char_length(last_chapter) between 1 and 800),
  -- The Claude model that wrote it, so recaps can be rewritten when the model changes.
  model         text        not null check (char_length(model) between 1 and 80),
  created_at    timestamptz not null default now(),
  primary key (volume_id, chapter_index)
);

alter table public.chapter_recaps enable row level security;
revoke all on public.chapter_recaps from public, anon, authenticated;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch it.
create policy "No browser access to chapter recaps"
  on public.chapter_recaps as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);
