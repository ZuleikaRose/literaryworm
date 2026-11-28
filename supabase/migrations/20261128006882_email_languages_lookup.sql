-- For the email functions: the language to write each address's email in, for a batch of addresses
-- (account_email_language() of the account that uses it), and a gift's buyer's language for a gift
-- emailed to someone without an account. Service role only; an address with no account isn't returned.

create or replace function public.email_languages(p_emails text[])
returns table (email text, language text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.email::text, public.account_email_language(u.id)
  from auth.users u
  where lower(u.email) = any (select lower(e) from unnest(coalesce(p_emails, '{}')) e)
    and cardinality(coalesce(p_emails, '{}')) <= 1000;
$$;
revoke execute on function public.email_languages(text[]) from public, anon, authenticated;
grant execute on function public.email_languages(text[]) to service_role;

create or replace function public.gift_buyer_language(p_gift uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select public.account_email_language(g.buyer_id) from public.gift_codes g where g.id = p_gift and g.buyer_id is not null), 'en');
$$;
revoke execute on function public.gift_buyer_language(uuid) from public, anon, authenticated;
grant execute on function public.gift_buyer_language(uuid) to service_role;
