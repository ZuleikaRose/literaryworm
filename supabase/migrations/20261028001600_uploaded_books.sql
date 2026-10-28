-- Bring your own books (Phase 21).
--
-- A member uploads an EPUB they own. The browser reads it and keeps only its
-- text, chapter by chapter, as a JSON file in the private user-books bucket,
-- in a folder named after the account (so a member can only ever reach their
-- own files). uploaded_books lists them for the profile that uploaded them,
-- with the chapter titles and word counts the reader needs before the text
-- loads. Its id ("u-" and 32 hex digits) is a valid volume id, so the library,
-- reading progress, bookmarks and highlights work on uploads as on any book.
--
-- Kids profiles can't upload (the content isn't rated). A profile keeps up to
-- 50 uploads; each text file is at most 15 MB.

create table public.uploaded_books (
  id             text primary key check (id ~ '^u-[0-9a-f]{32}$'),
  profile_id     uuid not null,
  user_id        uuid not null,
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  author         text not null default '' check (char_length(author) <= 200),
  chapter_titles text[] not null check (cardinality(chapter_titles) between 1 and 500),
  chapter_words  integer[] not null check (cardinality(chapter_words) = cardinality(chapter_titles)),
  words          integer not null check (words between 1 and 5000000),
  -- The text's place in the user-books bucket: <user_id>/<id>.json.
  storage_path   text not null unique,
  created_at     timestamptz not null default now(),
  check (storage_path = user_id::text || '/' || id || '.json'),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

alter table public.uploaded_books enable row level security;

create policy "Readers see their own uploads" on public.uploaded_books for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers upload to their own profiles" on public.uploaded_books for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers delete their own uploads" on public.uploaded_books for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.uploaded_books from anon, authenticated;
grant select, delete on public.uploaded_books to authenticated;
grant insert (id, profile_id, user_id, title, author, chapter_titles, chapter_words, words, storage_path) on public.uploaded_books to authenticated;

-- Not on Kids profiles, and up to 50 a profile.
create function private.enforce_upload_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select age_rating from public.reader_profiles where id = new.profile_id) = 'kids' then
    raise exception 'Kids profiles can''t upload books' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.uploaded_books where profile_id = new.profile_id) >= 50 then
    raise exception 'A profile can have up to 50 uploaded books' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_upload_rules() from public, anon, authenticated;

create trigger uploaded_books_rules
  before insert on public.uploaded_books
  for each row execute function private.enforce_upload_rules();

-- The bucket: private, JSON only, 15 MB a file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-books', 'user-books', false, 15728640, array['application/json'])
on conflict (id) do nothing;

-- Members read, add and remove files only in their own folder.
create policy "Members read their own book files" on storage.objects for select to authenticated
  using (bucket_id = 'user-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members add their own book files" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Members remove their own book files" on storage.objects for delete to authenticated
  using (bucket_id = 'user-books' and (storage.foldername(name))[1] = (select auth.uid())::text);
