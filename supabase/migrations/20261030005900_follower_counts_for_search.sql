-- Follower counts for an author search's authors, in one call (follower_count() does one person).
--
-- Like follower_count(): numbers, never who; callable by visitors, since search is public. At most
-- 50 names are counted (a search lists far fewer); names with no followers come back as 0.

create or replace function public.follower_counts(p_kind text, p_names text[])
returns table (name text, followers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.name, count(f.name)::integer
  from (select distinct btrim(x) as name from unnest(p_names[1:50]) as x where x is not null) as n
  left join public.follows f on f.kind = p_kind and f.name = n.name
  group by n.name;
$$;

revoke execute on function public.follower_counts(text, text[]) from public;
grant execute on function public.follower_counts(text, text[]) to anon, authenticated;
