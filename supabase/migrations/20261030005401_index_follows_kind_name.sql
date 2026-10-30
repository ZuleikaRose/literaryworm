-- For follower_count(). Kept to one statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists follows_kind_name_idx on public.follows (kind, name);
