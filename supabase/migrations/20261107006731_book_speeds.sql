-- A listening speed per book (lib/bookSpeed.ts, Player settings → Keep this speed for this book):
-- kept with the profile's other player settings as {book id: speed}, up to 200 books (the browser
-- keeps the newest), each 0.5–3. The profile's own account reads and changes it.

alter table public.reader_profiles
  add column if not exists book_speeds jsonb not null default '{}'::jsonb;

alter table public.reader_profiles
  drop constraint if exists reader_profiles_book_speeds_check;
alter table public.reader_profiles
  add constraint reader_profiles_book_speeds_check
  check (jsonb_typeof(book_speeds) = 'object' and pg_column_size(book_speeds) <= 16384);

grant select (book_speeds) on public.reader_profiles to authenticated;
grant update (book_speeds) on public.reader_profiles to authenticated;
