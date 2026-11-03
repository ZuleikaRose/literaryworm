-- A short-lived cache of what Google Books has told the `books` Edge Function, so the same answer
-- isn't asked for again while it may still be kept, and the Google Books API quota goes further.
--
--   google_books_volumes: one book's details (an edition, by its volume id), cover link included.
--   google_books_lists:   one page of a list (Home, a genre, a search, an author, an ISBN).
--
-- Every row expires (expires_at): no later than Google's own cache headers allow on the answer
-- (the Google APIs Terms of Service, 5(e): no copy kept longer than the cache header permits, and
-- no permanent copies), and never more than 7 days (CACHE_MAX_SECONDS in _shared/bookCache.ts).
-- When Google's headers allow no caching (no-store, no-cache, private, or no lifetime), nothing is
-- kept. The function never serves an expired row, and pg_cron deletes them every hour.
--
-- Only the function (service_role) reads and writes these rows; browser roles have no access and
-- go through the function. Nothing here is about a person: requests' IPs and users aren't kept.

create table public.google_books_volumes (
  id         text        primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  -- The shaped BookDetail the function returns (_shared/googleBooks.ts), cover link included.
  detail     jsonb       not null check (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 32768),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint google_books_volumes_kept_at_most_7_days
    check (expires_at > fetched_at and expires_at <= fetched_at + interval '7 days')
);

create table public.google_books_lists (
  -- The query as sent to Google (q, page, sort, language): listCacheKey().
  key        text        primary key check (char_length(key) between 1 and 600),
  -- The shaped BookPage the function returns.
  page       jsonb       not null check (jsonb_typeof(page) = 'object' and octet_length(page::text) <= 65536),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint google_books_lists_kept_at_most_7_days
    check (expires_at > fetched_at and expires_at <= fetched_at + interval '7 days')
);

-- The hourly cleanup finds expired rows by expires_at: its indexes are 6669 and 6670 (CONCURRENTLY, one each).

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

-- Expired answers are deleted every hour, so nothing stays past what Google allowed.
select cron.schedule(
  'google-books-cache-cleanup',
  '17 * * * *',
  $$delete from public.google_books_volumes where expires_at <= now();
    delete from public.google_books_lists where expires_at <= now()$$
);
