-- Polls can offer uploaded books: the club's owner can put up to 5 of their own uploads (by id) beside
-- LiteraryWorm titles. Uploads stay private, so the poll keeps only each upload's title and author
-- (club_polls.upload_labels, copied here from the owner's upload, never sent by the browser), and
-- members who want to read the winner choose their own copy, as in a club on an uploaded book.

alter table public.club_polls
  add column if not exists upload_labels jsonb not null default '{}'::jsonb
    check (jsonb_typeof(upload_labels) = 'object' and pg_column_size(upload_labels) <= 8192);
grant select (upload_labels) on public.club_polls to authenticated;

create or replace function private.check_club_poll()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_option text;
  v_upload record;
begin
  new.created_by := (select auth.uid());
  new.question := btrim(new.question);
  if not exists (select 1 from public.book_clubs b where b.id = new.club_id and b.owner_id = new.created_by) then
    raise exception 'Only the club''s owner can start a poll' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from unnest(new.options) o where o !~ '^[A-Za-z0-9_-]{1,40}$')
     or (select count(distinct o) from unnest(new.options) o) <> cardinality(new.options) then
    raise exception 'A poll offers 2 to 5 different books' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.club_polls p where p.club_id = new.club_id) >= 50 then
    raise exception 'A club can have up to 50 polls' using errcode = 'check_violation';
  end if;
  -- Uploads: only the owner's own, named by title and author, never by anything the browser sends.
  new.upload_labels := '{}'::jsonb;
  foreach v_option in array new.options loop
    if v_option ~ '^u-[0-9a-f]{32}$' then
      select u.title, u.author into v_upload from public.uploaded_books u where u.id = v_option and u.user_id = new.created_by;
      if not found then
        raise exception 'A poll can offer only your own uploads' using errcode = 'check_violation';
      end if;
      new.upload_labels := new.upload_labels || jsonb_build_object(v_option, jsonb_build_object('title', v_upload.title, 'author', v_upload.author));
    end if;
  end loop;
  new.closed_at := null;
  new.winner := null;
  return new;
end;
$$;

revoke execute on function private.check_club_poll() from public, anon, authenticated;
