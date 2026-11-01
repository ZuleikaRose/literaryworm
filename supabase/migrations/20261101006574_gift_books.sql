-- Gift a book or a list with a gift membership: a gift code can come with up to 10 LiteraryWorm
-- books (catalog ids). The buyer picks them on Gifts; checkout puts them in the Checkout Session's
-- metadata and stripe-webhook writes them here (both check them against the catalog); the
-- recipient's email names them (claim_gift_deliveries() now returns them), and manage-account adds
-- them to the redeemer's library as Want to read. The buyer reads them like the rest of the gift.

alter table public.gift_codes
  add column books text[] not null default '{}'
    check (cardinality(books) <= 10 and array_position(books, null) is null);

grant select (books) on public.gift_codes to authenticated;

drop function public.claim_gift_deliveries(integer);
create function public.claim_gift_deliveries(max_count integer default 200)
returns table (gift_id uuid, code text, plan_id text, months smallint, starts_on date, recipient_email text, message text, buyer_name text, books text[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select g.id
    from public.gift_codes g
    where g.recipient_email is not null
      and g.delivered_at is null
      and g.redeemed_at is null
      and (g.starts_on is null or now() >= (g.starts_on::timestamp + interval '8 hours') at time zone 'utc')
    order by g.created_at
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update skip locked
  ), claimed as (
    update public.gift_codes g set delivered_at = now()
    from due where g.id = due.id
    returning g.id, g.code, g.plan_id, g.months, g.starts_on, g.recipient_email, g.message, g.buyer_id, g.books
  )
  select c.id, c.code, c.plan_id, c.months, c.starts_on, c.recipient_email, c.message, p.display_name, c.books
  from claimed c
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;
revoke execute on function public.claim_gift_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_deliveries(integer) to service_role;
