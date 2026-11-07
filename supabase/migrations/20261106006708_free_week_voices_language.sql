-- Three small additions:
-- 1. A first membership's free week (FREE_TRIAL_DAYS, 7): checkout asks Stripe for a trial on a
--    first membership only, and stripe-webhook keeps its end in subscriptions.trial_until while it
--    lasts (subscriptionRow() in _shared/stripe.ts). Account shows it as the first charge.
-- 2. natural_voice_usage.mostly_used_at: when this month's new natural-voice reading passed 80% of
--    the plan's allowance, set once by claim_natural_voice(), so the bell can say so once.
-- 3. uploaded_books.language: the EPUB's dc:language (two or three letters, e.g. "fr"), read in the
--    browser when it's uploaded, so natural voices can read it in its own language. Null for
--    earlier uploads and EPUBs that don't say.

alter table public.subscriptions add column if not exists trial_until timestamptz;
comment on column public.subscriptions.trial_until is
  'While a first membership''s free week lasts: when it ends and the first charge is made. Written by stripe-webhook from Stripe.';
grant select (trial_until) on public.subscriptions to authenticated;

alter table public.natural_voice_usage add column if not exists mostly_used_at timestamptz;
grant select (mostly_used_at) on public.natural_voice_usage to authenticated;

create or replace function public.claim_natural_voice(p_account uuid, p_characters integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
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
  return found;
end;
$$;

revoke execute on function public.claim_natural_voice(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_natural_voice(uuid, integer, integer) to service_role;

alter table public.uploaded_books add column if not exists language text check (language ~ '^[a-z]{2,3}$');
comment on column public.uploaded_books.language is
  'The EPUB''s dc:language, two or three lowercase letters, or null when it doesn''t say. Natural voices read the book in it.';
grant insert (language) on public.uploaded_books to authenticated;
