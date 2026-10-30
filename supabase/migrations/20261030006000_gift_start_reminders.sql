-- A reminder to the buyer of a gift set to start on a later day, three days before that day.
--
-- gift_codes.reminded_at marks a gift whose buyer has been reminded (server only, never granted to
-- the browser). claim_gift_start_reminders() picks the due ones once, for the gift-reminders
-- function, which pg_cron calls each day. Only gifts bought at least four days before they start,
-- not redeemed, whose buyer still has a confirmed address. The email has no code in it.

alter table public.gift_codes add column reminded_at timestamptz;

create or replace function public.claim_gift_start_reminders(max_count integer default 200)
returns table (gift_id uuid, plan_id text, months smallint, starts_on date, email text, buyer_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select g.id
    from public.gift_codes g
    where g.reminded_at is null
      and g.redeemed_at is null
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

-- The secret the cron job sends and the gift-reminders function checks: 32 random bytes, made once.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gift_reminders_secret', 'Sent by the gift-reminders cron job; checked by the function')
where not exists (select 1 from vault.secrets where name = 'gift_reminders_secret');

create or replace function public.gift_reminders_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gift_reminders_secret';
$$;
revoke execute on function public.gift_reminders_secret() from public, anon, authenticated;
grant execute on function public.gift_reminders_secret() to service_role;

create or replace function private.call_gift_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base   text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'gift_reminders_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/functions/v1/gift-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;
revoke execute on function private.call_gift_reminders() from public, anon, authenticated;

-- Daily at 15:00 UTC: morning in the Americas, afternoon in Europe.
select cron.schedule('gift-start-reminders', '0 15 * * *', $$select private.call_gift_reminders()$$);
