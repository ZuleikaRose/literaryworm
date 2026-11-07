-- Gift cards: a gift of $25, $50 or $100 of credit for a membership, beside gift memberships.
-- A gift card is a gift_codes row of kind 'credit': credit_cents instead of a plan and months, and no
-- books. checkout sells it on the literaryworm_gift_card Stripe product, stripe-webhook makes the code,
-- and manage-account redeems it into the redeemer's Stripe customer balance (taken off their next
-- charges). Start days, emailing the code and the buyer's reminder work as they do for memberships,
-- so both claim functions now also return credit_cents.

alter table public.gift_codes
  add column kind text not null default 'membership' check (kind in ('membership', 'credit')),
  add column credit_cents integer check (credit_cents is null or credit_cents in (2500, 5000, 10000)),
  alter column plan_id drop not null,
  alter column months drop not null;

alter table public.gift_codes
  add constraint gift_codes_kind_shape check (
    (kind = 'membership' and plan_id is not null and months is not null and credit_cents is null)
    or (kind = 'credit' and plan_id is null and months is null and credit_cents is not null and cardinality(books) = 0)
  );

grant select (kind, credit_cents) on public.gift_codes to authenticated;

drop function public.claim_gift_deliveries(integer);
create function public.claim_gift_deliveries(max_count integer default 200)
returns table (gift_id uuid, code text, plan_id text, months smallint, credit_cents integer, starts_on date, recipient_email text, message text, buyer_name text, books text[])
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
    returning g.id, g.code, g.plan_id, g.months, g.credit_cents, g.starts_on, g.recipient_email, g.message, g.buyer_id, g.books
  )
  select c.id, c.code, c.plan_id, c.months, c.credit_cents, c.starts_on, c.recipient_email, c.message, p.display_name, c.books
  from claimed c
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;

revoke execute on function public.claim_gift_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_deliveries(integer) to service_role;

drop function public.claim_gift_start_reminders(integer);
create function public.claim_gift_start_reminders(max_count integer default 200)
returns table (gift_id uuid, plan_id text, months smallint, credit_cents integer, starts_on date, email text, buyer_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (now() at time zone 'utc')::time < time '15:00' then
    return;
  end if;
  return query
  with due as (
    select g.id
    from public.gift_codes g
    where g.reminded_at is null
      and g.redeemed_at is null
      and g.recipient_email is null
      and g.delivered_at is null
      and g.buyer_id is not null
      and g.starts_on is not null
      and g.starts_on between (now() at time zone 'utc')::date and (now() at time zone 'utc')::date + 3
      and g.starts_on >= (g.created_at at time zone 'utc')::date + 4
    order by g.starts_on
    limit least(greatest(coalesce(max_count, 200), 1), 500)
    for update skip locked
  ), claimed as (
    update public.gift_codes g set reminded_at = now()
    from due where g.id = due.id
    returning g.id, g.plan_id, g.months, g.credit_cents, g.starts_on, g.buyer_id
  )
  select c.id, c.plan_id, c.months, c.credit_cents, c.starts_on, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.buyer_id and u.email is not null and u.email_confirmed_at is not null
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;

revoke execute on function public.claim_gift_start_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_start_reminders(integer) to service_role;
