-- My words: words a profile looked up in the reader's dictionary and kept.
--
-- Per profile, like follows: the word (lower case, the dictionary's own rules),
-- its first sense, the book, chapter and page it was met on and the sentence
-- around it. Practise marks words as known (`learned`, the only column that
-- changes). Up to 500 a profile. Deleting the profile (or the account) deletes
-- them through the foreign key.

create table public.saved_words (
  profile_id    uuid not null,
  user_id       uuid not null,
  word          text not null check (char_length(word) between 1 and 40 and word ~ '^[a-z]+([''-][a-z]+)*$'),
  definition    text check (definition is null or char_length(btrim(definition)) between 1 and 500),
  volume_id     text check (volume_id is null or char_length(volume_id) between 1 and 64),
  chapter_index smallint check (chapter_index is null or chapter_index between 0 and 999),
  page          smallint check (page is null or page between 0 and 999),
  context       text check (context is null or char_length(btrim(context)) between 1 and 400),
  learned       boolean not null default false,
  created_at    timestamptz not null default now(),
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, word),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_saved_word_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_words where profile_id = new.profile_id) >= 500 then
    raise exception 'A profile can keep up to 500 words' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_saved_word_limit() from public, anon, authenticated;

create trigger saved_words_limit
  before insert on public.saved_words
  for each row execute function private.enforce_saved_word_limit();

alter table public.saved_words enable row level security;

create policy "Readers see their own words" on public.saved_words for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Readers keep words for their own profiles" on public.saved_words for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Readers mark their own words" on public.saved_words for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Readers remove their own words" on public.saved_words for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.saved_words as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.saved_words from anon, authenticated;
grant select, delete on public.saved_words to authenticated;
grant insert (profile_id, user_id, word, definition, volume_id, chapter_index, page, context) on public.saved_words to authenticated;
grant update (learned) on public.saved_words to authenticated;
