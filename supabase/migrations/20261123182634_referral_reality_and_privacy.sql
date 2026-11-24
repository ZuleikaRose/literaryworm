-- Refer a friend, sixth review (after 174720; every statement is safe to run again).
--
-- * Cut-over "paid": a card payment by the cut-over, or a membership row made before 2026-11-10 (when
--   card payments weren't kept) that isn't complimentary or a gift and wasn't a free week only: no free
--   week (trial_until null), or still running after its free week ended. A free week cancelled before any
--   charge is not a payment. Undecided referrals made before the cut-over are set again by this rule.
-- * Privacy: stripe-webhook keeps only what a replay needs of a set-aside event (ids, amounts, currency,
--   statuses, the refunded flag). The payload is cleared when the event is resolved or dismissed, after
--   30 days (daily, pg_cron), and when the account it's about is deleted. Payloads kept whole before this
--   (dev only) are cleared now.

create or replace function private.referral_friend_paid_before(p_user uuid, p_at timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.account_private a where a.user_id = p_user and a.card_payment_at is not null and a.card_payment_at <= p_at)
      or exists (select 1 from public.subscriptions s
                 where s.user_id = p_user and not s.complimentary and s.gift_until is null
                   and s.created_at < timestamptz '2026-11-10 00:00:00+00' and s.created_at <= p_at
                   and (s.trial_until is null
                        or (s.trial_until < p_at and s.status in ('active', 'past_due', 'paused'))));
$$;
revoke execute on function private.referral_friend_paid_before(uuid, timestamptz) from public, anon, authenticated;

update public.referrals r
set reward_rule = case when private.referral_friend_paid_before(r.referred_id, d.done_at) then 'free_month' else 'percent_20' end
from (select min(done_at) as done_at from private.referral_cutover_done) d
where d.done_at is not null and r.created_at <= d.done_at
  and r.rewarded_at is null and r.friend_credit_id is null and r.referrer_credit_id is null
  and r.reward_rule is distinct from (case when private.referral_friend_paid_before(r.referred_id, d.done_at) then 'free_month' else 'percent_20' end);

-- A replayed event that went through is resolved and its payload cleared.
create or replace function public.record_referral_event_replay(p_event text, p_ok boolean, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.stripe_events set review_resolved_at = now(), review_payload = null where id = p_event and review_reason is not null;
  else
    update public.stripe_events set review_reason = left(coalesce(p_reason, review_reason), 500) where id = p_event;
  end if;
  return p_ok;
end;
$$;
revoke execute on function public.record_referral_event_replay(text, boolean, text) from public, anon, authenticated;
grant execute on function public.record_referral_event_replay(text, boolean, text) to service_role;

-- As in 174720, and the payload is cleared when dismissed.
create or replace function public.dismiss_referral_event(p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referral uuid;
  v_done integer;
begin
  select coalesce(e.review_referral, (select x.id from public.referrals x where x.referred_id = e.review_referred_user))
    into v_referral
  from public.stripe_events e where e.id = p_event;
  if v_referral is not null and private.referral_open(v_referral) then
    raise exception 'referral_still_owed: this referral still owes something at Stripe or has a take-back or give-back waiting. Use Retry now, or Write off a held side.'
      using errcode = 'object_in_use';
  end if;
  update public.stripe_events set review_resolved_at = now(), review_payload = null
  where id = p_event and review_reason is not null and review_resolved_at is null;
  get diagnostics v_done = row_count;
  return v_done > 0;
end;
$$;
revoke execute on function public.dismiss_referral_event(text) from public, anon, authenticated;
grant execute on function public.dismiss_referral_event(text) to service_role;

-- When an account is deleted, set-aside events about it keep nothing of it.
create or replace function private.forget_referral_review_payloads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stripe_events e
  set review_payload = null, review_referred_user = null
  where e.review_referred_user = old.id
     or (e.review_payload is not null
         and e.review_payload #>> '{data,object,customer}' in (select c.customer_id from public.stripe_customers c where c.user_id = old.id));
  return old;
end;
$$;
revoke execute on function private.forget_referral_review_payloads() from public, anon, authenticated;
drop trigger if exists forget_referral_review_payloads on auth.users;
create trigger forget_referral_review_payloads
  before delete on auth.users
  for each row execute function private.forget_referral_review_payloads();

-- Payloads are kept at most 30 days (a replay after that isn't possible; the team uses Retry now on the
-- referral, or Write off).
select cron.schedule(
  'referral-review-payloads-cleanup',
  '45 4 * * *',
  $$update public.stripe_events set review_payload = null where review_payload is not null and received_at < now() - interval '30 days'$$
);

-- Payloads kept whole before stripe-webhook trimmed them (174720 on dev) are cleared.
update public.stripe_events
set review_payload = null
where review_payload is not null
  and (review_payload #> '{data,object}') ?| array['email', 'name', 'address', 'phone', 'billing_details', 'customer_details',
                                                  'customer_email', 'customer_name', 'payment_method_details', 'metadata', 'shipping'];
