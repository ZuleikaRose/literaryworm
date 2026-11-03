-- A cache of what Google Books has told the `books` Edge Function, so the same answer is never
-- asked for twice and the Google Books API quota goes much further.
--
--   google_books_volumes: one book's details (an edition, by its volume id), with its cover link,
--     kept until another edition of the same book turns up; then it's marked stale and the next
--     request for it downloads it again.
--   google_books_lists: one page of a list (Home, a genre, a search, an author, an ISBN), kept a
--     week (LIST_FRESH in _shared/bookCache.ts). Refreshing a page is how new editions are found:
--     a volume id the page didn't have before, with the same title and author as a cached volume,
--     marks that volume stale.
--
-- Only the function (service_role) reads and writes these rows; browser roles have no access and
-- go through the function. Nothing here is about a person: the requests' IPs and users aren't kept.

create table public.google_books_volumes (
  id         text        primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- The shaped BookDetail the function returns (_shared/googleBooks.ts), cover link included.
  detail     jsonb       not null check (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 32768),
  -- Normalised title and first author's surname (workKey()), shared by every edition of a book.
  work_key   text        not null check (char_length(work_key) between 1 and 400),
  -- Another edition has appeared since this was downloaded: the next request downloads it again.
  stale      boolean     not null default false,
  fetched_at timestamptz not null default now()
);

create index google_books_volumes_work_key on public.google_books_volumes (work_key);

create table public.google_books_lists (
  -- The query as sent to Google (q, page, sort, language): listCacheKey().
  key        text        primary key check (char_length(key) between 1 and 600),
  -- The shaped BookPage the function returns.
  page       jsonb       not null check (jsonb_typeof(page) = 'object' and octet_length(page::text) <= 65536),
  volume_ids text[]      not null default '{}' check (cardinality(volume_ids) <= 40),
  fetched_at timestamptz not null default now()
);

alter table public.google_books_volumes enable row level security;
alter table public.google_books_lists enable row level security;
revoke all on public.google_books_volumes from public, anon, authenticated;
revoke all on public.google_books_lists from public, anon, authenticated;
grant select, insert, update, delete on public.google_books_volumes to service_role;
grant select, insert, update, delete on public.google_books_lists to service_role;

-- Says out loud what RLS already does with no permissive policy: browser roles can't touch the cache.
create policy "No browser access to cached volumes"
  on public.google_books_volumes as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No browser access to cached lists"
  on public.google_books_lists as restrictive for all
  to anon, authenticated
  using (false)
  with check (false);

-- Lists nobody has asked for in a month go (each search is a row); volumes stay, since a book's
-- details only change with a new edition.
select cron.schedule(
  'google-books-lists-cleanup',
  '40 3 * * *',
  $$delete from public.google_books_lists where fetched_at < now() - interval '30 days'$$
);
