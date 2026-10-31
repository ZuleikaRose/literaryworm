-- Up next: each profile's listening queue, catalog audiobooks in the order
-- they'll play. When a book finishes, the player offers the first one. Up to
-- 50 book ids, each a valid volume id.

alter table public.reader_profiles
  add column up_next text[] not null default '{}'
    check (cardinality(up_next) <= 50 and array_position(up_next, null) is null);

grant select (up_next) on public.reader_profiles to authenticated;
grant update (up_next) on public.reader_profiles to authenticated;
