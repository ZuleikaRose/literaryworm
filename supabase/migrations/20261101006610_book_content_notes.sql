-- AI-written content notes, one set per catalog book: for each of eight topics (violence, death,
-- frightening, language, sexual_content, substance_use, discrimination, self_harm) a level (none,
-- mild, moderate, strong) and a short note, plus one line overall. The `content-notes` Edge Function
-- writes them the first time anyone asks (Claude, from the book's title, author, year and synopsis;
-- nothing about the reader) and keeps them here, so every reader and every parent sees the same
-- notes. Only the function (service_role) reads and writes these rows; browser roles go through it.

create table public.book_content_notes (
  volume_id  text        primary key check (volume_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  overall    text        not null check (char_length(btrim(overall)) between 1 and 300),
  notes      jsonb       not null check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) = 8),
  -- The Claude model that wrote them, so they can be rewritten when the model changes.
  model      text        not null check (char_length(model) between 1 and 80),
  created_at timestamptz not null default now()
);

alter table public.book_content_notes enable row level security;
revoke all on public.book_content_notes from public, anon, authenticated;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch them.
create policy "No browser access to content notes"
  on public.book_content_notes as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);
