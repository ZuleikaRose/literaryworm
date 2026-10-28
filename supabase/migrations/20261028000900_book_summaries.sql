-- AI-written book summaries, a short one and a detailed one per book.
--
-- The `summaries` Edge Function writes a book's summaries the first time
-- anyone asks for them (Claude, from the book's title, author and description)
-- and keeps them here, so each book is summarised once and every later reader
-- gets the same text. A book is a LiteraryWorm catalog id or a Google Books
-- volume id, the same ids library_items uses.
--
-- Only the function (service_role) reads and writes these rows; browser roles
-- have no access at all and go through the function.

create table public.book_summaries (
  volume_id        text        primary key check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  short_summary    text        not null check (char_length(btrim(short_summary)) between 1 and 600),
  detailed_summary text        not null check (char_length(btrim(detailed_summary)) between 1 and 8000),
  -- The Claude model that wrote them, so they can be rewritten when the model changes.
  model            text        not null check (char_length(model) between 1 and 80),
  created_at       timestamptz not null default now()
);

alter table public.book_summaries enable row level security;
revoke all on public.book_summaries from public, anon, authenticated;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch summaries.
create policy "No browser access to book summaries"
  on public.book_summaries as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);
