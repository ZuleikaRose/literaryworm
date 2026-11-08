-- More natural-voice hours: a member whose plan's monthly hours aren't enough buys a pack of 5 or
-- 10 hours, paid once on Stripe Checkout (checkout { voiceHours }, product
-- literaryworm_voice_hours). Only stripe-webhook writes a pack, once per Checkout Session. A pack
-- is drawn on only after the month's plan allowance is used up, oldest first, and lasts 12 months
-- from purchase; what's left of it carries over from month to month.
--
-- * natural_voice_packs: per account; members read their own (hours, what's left, when it ends),
--   never the Stripe session.
-- * natural_voice_usage.pack_characters: what this month took from packs (so a piece that failed
--   to voice can be handed back to the right place).
-- * claim_natural_voice(): the plan's allowance first, then a pack. release_natural_voice() gives
--   back to a pack first when this month drew on one.
-- * add_natural_voice_pack(): for the webhook only.

create table public.natural_voice_packs (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references auth.users (id) on delete cascade,
  stripe_session text not null unique check (stripe_session ~ '^cs_[A-Za-z0-9_]{1,250}$'),
  hours          integer not null check (hours in (5, 10)),
  characters     integer not null check (characters > 0),
  used           integer not null default 0,
  amount_cents   integer not null check (amount_cents >= 0),
  bought_at      timestamptz not null default now(),
  expires_at     timestamptz not null,
  check (used between 0 and characters),
  check (expires_at > bought_at)
);
comment on table public.natural_voice_packs is
  'Natural-voice hours bought on top of the plan (5 or 10 hours, a year to use them). Written only by stripe-webhook (add_natural_voice_pack) and the natural-voice function (claim/release).';

alter table public.natural_voice_packs enable row level security;
create policy "Members see their voice packs" on public.natural_voice_packs for select to authenticated
  using (account_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.natural_voice_packs as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
revoke all on public.natural_voice_packs from anon, authenticated;
grant select (id, account_id, hours, characters, used, bought_at, expires_at) on public.natural_voice_packs to authenticated;
grant all on public.natural_voice_packs to service_role;

alter table public.natural_voice_usage add column if not exists pack_characters integer not null default 0 check (pack_characters >= 0);
grant select (pack_characters) on public.natural_voice_usage to authenticated;

-- Counts p_characters against this month's p_limit; when it won't fit there, against the pack
-- that ends soonest with room for it. False (and nothing counted) when neither has room.
create or replace function public.claim_natural_voice(p_account uuid, p_characters integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_pack uuid;
begin
  if p_account is null or p_characters is null or p_characters < 1 or p_characters > 5000 or p_limit is null or p_limit < 0 then
    raise exception 'claim_natural_voice: bad arguments';
  end if;
  insert into public.natural_voice_usage (account_id, month) values (p_account, v_month)
  on conflict (account_id, month) do nothing;
  update public.natural_voice_usage
     set characters = characters + p_characters,
         -- The first time this month's use passes 80% of the allowance.
         mostly_used_at = coalesce(mostly_used_at, case when characters + p_characters >= p_limit * 0.8 then now() end)
   where account_id = p_account and month = v_month and characters + p_characters <= p_limit;
  if found then
    return true;
  end if;
  select id into v_pack
    from public.natural_voice_packs
   where account_id = p_account and expires_at > now() and characters - used >= p_characters
   order by expires_at, id
   limit 1
   for update;
  if v_pack is null then
    return false;
  end if;
  update public.natural_voice_packs set used = used + p_characters where id = v_pack;
  update public.natural_voice_usage set pack_characters = pack_characters + p_characters
   where account_id = p_account and month = v_month;
  return true;
end;
$$;

-- Hands back a claim whose piece couldn't be voiced: to a pack when this month drew on one,
-- else to the month's allowance.
create or replace function public.release_natural_voice(p_account uuid, p_characters integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_pack uuid;
begin
  update public.natural_voice_usage
     set pack_characters = pack_characters - p_characters
   where account_id = p_account and month = v_month and pack_characters >= p_characters;
  if found then
    select id into v_pack
      from public.natural_voice_packs
     where account_id = p_account and used >= p_characters
     order by expires_at, id
     limit 1
     for update;
    if v_pack is not null then
      update public.natural_voice_packs set used = used - p_characters where id = v_pack;
    end if;
    return;
  end if;
  update public.natural_voice_usage
     set characters = greatest(0, characters - p_characters)
   where account_id = p_account and month = v_month;
end;
$$;

revoke execute on function public.claim_natural_voice(uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.release_natural_voice(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_natural_voice(uuid, integer, integer) to service_role;
grant execute on function public.release_natural_voice(uuid, integer) to service_role;

-- A paid pack, once per Checkout Session (a repeated event changes nothing).
create or replace function public.add_natural_voice_pack(p_account uuid, p_session text, p_hours integer, p_characters integer, p_amount_cents integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.natural_voice_packs (account_id, stripe_session, hours, characters, amount_cents, expires_at)
  values (p_account, p_session, p_hours, p_characters, p_amount_cents, now() + interval '12 months')
  on conflict (stripe_session) do nothing;
$$;
revoke execute on function public.add_natural_voice_pack(uuid, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.add_natural_voice_pack(uuid, text, integer, integer, integer) to service_role;
