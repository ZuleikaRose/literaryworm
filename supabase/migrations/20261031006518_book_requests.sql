-- Book requests: a Kids profile asks a grown-up for a catalog title rated above it.
--
-- Per profile, like saved_words: the book (a catalog id), when it was asked and the answer.
-- Kids profiles ask from the browser (insert); the answer is the grown-up's, so the browser
-- can't write `status`: the manage-profile function sets it after re-checking the account
-- password (service role). An approved request lets that profile open that one book
-- (lib/bookRequests.ts). Withdrawing or taking back a request deletes the row. Up to 50 a
-- profile. Deleting the profile (or the account) deletes them through the foreign key.

create table public.book_requests (
  profile_id  uuid not null,
  user_id     uuid not null,
  volume_id   text not null check (char_length(volume_id) between 1 and 64),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  check ((status = 'pending') = (answered_at is null)),
  -- Leads with (profile_id, user_id), so it also indexes the foreign key.
  primary key (profile_id, user_id, volume_id),
  foreign key (profile_id, user_id) references public.reader_profiles (id, account_id) on delete cascade
);

create or replace function private.enforce_book_request_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.book_requests where profile_id = new.profile_id) >= 50 then
    raise exception 'A profile can keep up to 50 book requests' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_book_request_limit() from public, anon, authenticated;

create trigger book_requests_limit
  before insert on public.book_requests
  for each row execute function private.enforce_book_request_limit();

alter table public.book_requests enable row level security;

create policy "Accounts see their profiles' book requests" on public.book_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Kids profiles ask for books" on public.book_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.reader_profiles p
      where p.id = profile_id and p.account_id = (select auth.uid()) and p.age_rating = 'kids'
    )
  );
create policy "Accounts withdraw their book requests" on public.book_requests for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.book_requests as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));

revoke all on public.book_requests from anon, authenticated;
grant select, delete on public.book_requests to authenticated;
grant insert (profile_id, user_id, volume_id) on public.book_requests to authenticated;
