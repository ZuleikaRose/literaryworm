-- The most-followed authors (or narrators), for a row on members' Home.
--
-- Like follower_count() and follower_counts(): names and numbers, never who. Only people with at
-- least two followers, so the row shows what readers share rather than one household's taste. At
-- most 12, most followed first (then by name). The follows (kind, name) index (migration 5401)
-- covers it.

create or replace function public.most_followed(p_kind text, p_limit integer default 8)
returns table (name text, followers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name, count(*)::integer as followers
  from public.follows f
  where f.kind = p_kind
  group by f.name
  having count(*) >= 2
  order by count(*) desc, f.name
  limit least(greatest(coalesce(p_limit, 8), 1), 12);
$$;

revoke execute on function public.most_followed(text, integer) from public;
grant execute on function public.most_followed(text, integer) to anon, authenticated;
