-- Discussion questions for book clubs: for a public-domain title, 5 to 8 open questions about one
-- chapter, written only from the text up to the end of that chapter, so they can't spoil anything
-- later. The `discussion` Edge Function asks Claude the first time any club needs a chapter's
-- questions and keeps them here, so every later club at that chapter gets the same ones.
--
-- Only the function (service_role) reads and writes these rows; browser roles have no access
-- at all and go through the function. Nothing here is about any member or club.

create table public.chapter_discussions (
  volume_id     text        not null check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- 0-based: the chapter the questions are about.
  chapter_index smallint    not null check (chapter_index between 0 and 999),
  -- Plain-text questions, each ending in a question mark (checked by the function).
  questions     text[]      not null check (cardinality(questions) between 5 and 8 and array_position(questions, null) is null),
  -- The Claude model that wrote them, so questions can be rewritten when the model changes.
  model         text        not null check (char_length(model) between 1 and 80),
  created_at    timestamptz not null default now(),
  primary key (volume_id, chapter_index)
);

alter table public.chapter_discussions enable row level security;
revoke all on public.chapter_discussions from public, anon, authenticated;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch it.
create policy "No browser access to chapter discussions"
  on public.chapter_discussions as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);
