-- Send a gift by email: the buyer gives the recipient's address (and a short message, if they
-- like) at checkout, and the gift-reminders function emails them the code once it can be redeemed.
--
-- gift_codes.recipient_email and .message come from the Checkout Session's metadata (the checkout
-- function checked them); stripe-webhook writes them with the code. claim_gift_deliveries() picks
-- each due gift once (delivered_at): straight away for a gift that starts now, at 08:00 UTC on
-- the start day for a later one (early morning in the Americas, morning in Europe), and never one
-- already redeemed. Once the email has gone, the function clears the address and the message, so
-- they're kept only until then; a failed send is handed back for the next run.
--
-- The buyer isn't sent the three-day reminder for a gift we deliver, and reminders still go out
-- in the afternoon (UTC): the job now runs hourly so deliveries aren't held back to one run a day.

alter table public.gift_codes
  add column recipient_email text check (
    recipient_email is null
    or (char_length(recipient_email) between 3 and 254 and recipient_email = lower(btrim(recipient_email)) and recipient_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  add column message text check (message is null or (char_length(message) between 1 and 300 and message = btrim(message))),
  add column delivered_at timestamptz;

grant select (recipient_email, message, delivered_at) on public.gift_codes to authenticated;

create or replace function public.claim_gift_deliveries(max_count integer default 200)
returns table (gift_id uuid, code text, plan_id text, months smallint, starts_on date, recipient_email text, message text, buyer_name text)
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
    returning g.id, g.code, g.plan_id, g.months, g.starts_on, g.recipient_email, g.message, g.buyer_id
  )
  select c.id, c.code, c.plan_id, c.months, c.starts_on, c.recipient_email, c.message, p.display_name
  from claimed c
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;
revoke execute on function public.claim_gift_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_deliveries(integer) to service_role;

-- As in migration 6000, but not for a gift we email to its recipient, and from 15:00 UTC.
create or replace function public.claim_gift_start_reminders(max_count integer default 200)
returns table (gift_id uuid, plan_id text, months smallint, starts_on date, email text, buyer_name text)
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
    returning g.id, g.plan_id, g.months, g.starts_on, g.buyer_id
  )
  select c.id, c.plan_id, c.months, c.starts_on, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.buyer_id and u.email is not null and u.email_confirmed_at is not null
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;
revoke execute on function public.claim_gift_start_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_start_reminders(integer) to service_role;

-- Hourly, five past (it was daily at 15:00).
select cron.unschedule('gift-start-reminders') where exists (select 1 from cron.job where jobname = 'gift-start-reminders');
select cron.schedule('gift-emails', '5 * * * *', $$select private.call_gift_reminders()$$);
