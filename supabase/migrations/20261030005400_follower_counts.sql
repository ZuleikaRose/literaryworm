-- How many reader profiles follow an author or narrator, for their public page.
--
-- follows is private to each account (RLS), so the count comes from this security-definer
-- function: a number, never who. Callable by visitors too, since author pages are public; it
-- returns no member data, so it doesn't wait for the second sign-in step.

create or replace function public.follower_count(p_kind text, p_name text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.follows
  where kind = p_kind and name = btrim(p_name);
$$;

revoke execute on function public.follower_count(text, text) from public;
grant execute on function public.follower_count(text, text) to anon, authenticated;
