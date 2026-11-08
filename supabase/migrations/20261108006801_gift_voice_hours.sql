-- Gift natural-voice hours: a gift_codes row of kind 'voice_hours' (5 or 10 hours, the same packs
-- members buy for themselves), sold on the literaryworm_voice_hours Stripe product. stripe-webhook
-- makes the code; manage-account redeems it into a natural_voice_packs row for the redeemer (12
-- months from redeeming, used after the month's plan hours). Start days, emailing the code and the
-- buyer's reminder work as for the other gifts, so both claim functions also return voice_hours.

alter table public.gift_codes drop constraint if exists gift_codes_kind_check;
alter table public.gift_codes add constraint gift_codes_kind_check check (kind in ('membership', 'credit', 'voice_hours'));
alter table public.gift_codes add column if not exists voice_hours smallint check (voice_hours is null or voice_hours in (5, 10));

alter table public.gift_codes drop constraint gift_codes_kind_shape;
alter table public.gift_codes
  add constraint gift_codes_kind_shape check (
    (kind = 'membership' and plan_id is not null and months is not null and credit_cents is null and voice_hours is null)
    or (kind = 'credit' and plan_id is null and months is null and credit_cents is not null and voice_hours is null and cardinality(books) = 0)
    or (kind = 'voice_hours' and plan_id is null and months is null and credit_cents is null and voice_hours is not null and cardinality(books) = 0)
  );

grant select (voice_hours) on public.gift_codes to authenticated;

-- A pack from a redeemed gift is keyed by the gift's Checkout Session, like a bought one.
alter table public.natural_voice_packs add column if not exists gift_id uuid unique references public.gift_codes (id) on delete set null;

drop function public.claim_gift_deliveries(integer);
create function public.claim_gift_deliveries(max_count integer default 200)
returns table (gift_id uuid, code text, plan_id text, months smallint, credit_cents integer, voice_hours smallint, starts_on date, recipient_email text, message text, buyer_name text, books text[])
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
    returning g.id, g.code, g.plan_id, g.months, g.credit_cents, g.voice_hours, g.starts_on, g.recipient_email, g.message, g.buyer_id, g.books
  )
  select c.id, c.code, c.plan_id, c.months, c.credit_cents, c.voice_hours, c.starts_on, c.recipient_email, c.message, p.display_name, c.books
  from claimed c
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;

revoke execute on function public.claim_gift_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_deliveries(integer) to service_role;

drop function public.claim_gift_start_reminders(integer);
create function public.claim_gift_start_reminders(max_count integer default 200)
returns table (gift_id uuid, plan_id text, months smallint, credit_cents integer, voice_hours smallint, starts_on date, email text, buyer_name text)
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
    returning g.id, g.plan_id, g.months, g.credit_cents, g.voice_hours, g.starts_on, g.buyer_id
  )
  select c.id, c.plan_id, c.months, c.credit_cents, c.voice_hours, c.starts_on, u.email::text, p.display_name
  from claimed c
  join auth.users u on u.id = c.buyer_id and u.email is not null and u.email_confirmed_at is not null
  left join public.profiles p on p.id = c.buyer_id;
end;
$$;

revoke execute on function public.claim_gift_start_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_gift_start_reminders(integer) to service_role;

-- Redeeming a natural-voice-hours gift (manage-account, after it claims the code for the account):
-- the pack starts the day it's redeemed and lasts 12 months, used after the month's plan hours.
create or replace function public.add_gift_voice_pack(p_account uuid, p_gift uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.natural_voice_packs (account_id, stripe_session, hours, characters, amount_cents, expires_at, gift_id)
  select p_account, g.stripe_checkout_session_id, g.voice_hours, g.voice_hours * 50400, g.amount_cents, now() + interval '12 months', g.id
  from public.gift_codes g
  where g.id = p_gift and g.kind = 'voice_hours' and g.redeemed_by = p_account
  on conflict (stripe_session) do nothing;
$$;
revoke execute on function public.add_gift_voice_pack(uuid, uuid) from public, anon, authenticated;
grant execute on function public.add_gift_voice_pack(uuid, uuid) to service_role;
