-- Refer a friend, final review (after 182634; every statement is safe to run again).
--
-- * A set-aside refund or dispute keeps its payload until it's resolved or dismissed: the daily cron
--   clears payloads only on events already resolved or dismissed (older than 30 days). The trimmed
--   payload holds no personal data, and account deletion still clears it.
-- * Dismiss refuses an unresolved refund or dispute whose payload is still there and that hasn't been
--   replayed (review_replayed_at), so a take-back can't be dismissed away.

alter table public.stripe_events add column if not exists review_replayed_at timestamptz;

select cron.schedule(
  'referral-review-payloads-cleanup',
  '45 4 * * *',
  $$update public.stripe_events set review_payload = null where review_payload is not null and review_resolved_at is not null and received_at < now() - interval '30 days'$$
);

-- As in 182634, and every replay is noted (review_replayed_at).
create or replace function public.record_referral_event_replay(p_event text, p_ok boolean, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.stripe_events set review_resolved_at = now(), review_payload = null, review_replayed_at = now()
    where id = p_event and review_reason is not null;
  else
    update public.stripe_events set review_reason = left(coalesce(p_reason, review_reason), 500), review_replayed_at = now()
    where id = p_event;
  end if;
  return p_ok;
end;
$$;
revoke execute on function public.record_referral_event_replay(text, boolean, text) from public, anon, authenticated;
grant execute on function public.record_referral_event_replay(text, boolean, text) to service_role;

create or replace function public.dismiss_referral_event(p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.stripe_events;
  v_referral uuid;
  v_done integer;
begin
  select * into e from public.stripe_events x where x.id = p_event;
  if e.id is not null and e.review_resolved_at is null and e.review_payload is not null and e.review_replayed_at is null
     and e.type in ('charge.refunded', 'charge.dispute.created', 'charge.dispute.closed') then
    raise exception 'referral_not_replayed: replay this refund or dispute with Retry now before dismissing it.'
      using errcode = 'object_in_use';
  end if;
  v_referral := coalesce(e.review_referral, (select x.id from public.referrals x where x.referred_id = e.review_referred_user));
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
