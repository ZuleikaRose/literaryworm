-- COPPA: a parent's consent to a Kids profile is verified by a card payment on the account, one of
-- the FTC's listed methods (a card or other online payment used in a monetary transaction, which
-- notifies the account holder). account_private.card_payment_at is when the account first paid
-- something real through Stripe (a membership invoice above $0, or a paid Checkout: membership,
-- natural-voice hours, a gift or a gift card); stripe-webhook sets it once through
-- record_card_payment(). Creating a Kids profile, or moving one to Kids, needs it. Consents given
-- before this (method account_password_confirmation) stay recorded as they were.

alter table public.account_private add column card_payment_at timestamptz;

-- The browser may read it (Account and the profile editor say what's needed), never write it.
grant select (card_payment_at) on public.account_private to authenticated;

alter table public.parental_consents alter column method set default 'card_payment';
alter table public.parental_consents
  add constraint parental_consents_method_check
  check (method in ('account_password_confirmation', 'card_payment'));

-- Called by stripe-webhook (service role) when a real payment arrives. Keeps the first time.
create or replace function public.record_card_payment(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_private
  set card_payment_at = now()
  where user_id = p_user_id and card_payment_at is null;
$$;

revoke execute on function public.record_card_payment(uuid) from public, anon, authenticated;
grant execute on function public.record_card_payment(uuid) to service_role;

-- True when the account's consent can be verified (a card payment on record).
create or replace function private.consent_verifiable(p_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_private
    where user_id = p_account_id and card_payment_at is not null
  );
$$;

revoke execute on function private.consent_verifiable(uuid) from public, anon, authenticated;

create or replace function public.create_kids_profile(
  p_account_id uuid, p_name text, p_avatar smallint, p_daily_limit_minutes smallint, p_notice_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not private.consent_verifiable(p_account_id) then
    raise exception 'Before you add a Kids profile, make a payment on this account with your card. That is how we confirm a parent''s consent.'
      using errcode = 'check_violation';
  end if;

  insert into public.reader_profiles (account_id, name, avatar, age_rating, daily_limit_minutes, kids_consent_at)
  values (p_account_id, btrim(p_name), coalesce(p_avatar, 0), 'kids', p_daily_limit_minutes, now())
  returning id into new_id;

  insert into public.parental_consents (account_id, profile_id, notice_version, method)
  values (p_account_id, new_id, p_notice_version, 'card_payment');

  return new_id;
end;
$$;

revoke execute on function public.create_kids_profile(uuid, text, smallint, smallint, text) from public, anon, authenticated;
grant execute on function public.create_kids_profile(uuid, text, smallint, smallint, text) to service_role;

create or replace function public.set_profile_age_rating(
  p_account_id uuid, p_profile_id uuid, p_age_rating public.age_rating, p_notice_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_rating public.age_rating;
begin
  select age_rating into current_rating from public.reader_profiles
  where id = p_profile_id and account_id = p_account_id
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'no_data_found';
  end if;
  if current_rating = p_age_rating then
    return;
  end if;

  if p_age_rating = 'kids' then
    if p_notice_version is null or char_length(p_notice_version) not between 1 and 40 then
      raise exception 'A Kids profile needs the parent''s consent' using errcode = 'check_violation';
    end if;
    if not private.consent_verifiable(p_account_id) then
      raise exception 'Before you add a Kids profile, make a payment on this account with your card. That is how we confirm a parent''s consent.'
        using errcode = 'check_violation';
    end if;
    update public.reader_profiles
    set age_rating = 'kids', kids_consent_at = now()
    where id = p_profile_id;
    insert into public.parental_consents (account_id, profile_id, notice_version, method)
    values (p_account_id, p_profile_id, p_notice_version, 'card_payment');
  else
    update public.reader_profiles
    set age_rating = p_age_rating, kids_consent_at = null
    where id = p_profile_id;
    update public.parental_consents
    set withdrawn_at = now()
    where profile_id = p_profile_id and account_id = p_account_id and withdrawn_at is null;
  end if;
end;
$$;

revoke execute on function public.set_profile_age_rating(uuid, uuid, public.age_rating, text) from public, anon, authenticated;
grant execute on function public.set_profile_age_rating(uuid, uuid, public.age_rating, text) to service_role;
