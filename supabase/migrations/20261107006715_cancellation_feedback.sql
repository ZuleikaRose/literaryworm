-- Why members cancel, and the offers made before they go (lib/cancelSurvey.ts, _shared/cancelReasons.ts).
--
-- cancellation_feedback: the optional answer from Account's cancel dialog, written only by the
-- manage-account function (service role): the reason, an optional note (500 characters), the offer
-- shown and whether the member cancelled or stayed. Kept a year (pg_cron), and removed with the account.
-- save_offer_credits: the once-per-account month's credit offered instead of cancelling, claimed
-- before Stripe credits it (and handed back if Stripe fails).
-- cancellation_reasons(): counts by reason for billing staff and admins, never who or what they wrote.

create table public.cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('too_expensive', 'not_enough_time', 'missing_books', 'technical_problems', 'found_another', 'taking_a_break', 'other')),
  comment text check (comment is null or char_length(comment) <= 500),
  offer text check (offer is null or offer in ('pause', 'downgrade', 'credit', 'upload', 'help')),
  outcome text not null check (outcome in ('cancelled', 'kept')),
  plan_id text,
  billing_interval text,
  created_at timestamptz not null default now()
);

alter table public.cancellation_feedback enable row level security;
revoke all on public.cancellation_feedback from anon, authenticated;
grant all on public.cancellation_feedback to service_role;

create table public.save_offer_credits (
  account_id uuid primary key references auth.users (id) on delete cascade,
  credited_cents integer not null check (credited_cents > 0),
  claimed_at timestamptz not null default now()
);

alter table public.save_offer_credits enable row level security;
revoke all on public.save_offer_credits from anon, authenticated;
grant all on public.save_offer_credits to service_role;

-- Counts by reason over the last p_days days (1-365), with how many stayed and the offers that
-- kept them. Billing staff and admins, after the second step.
create or replace function public.cancellation_reasons(p_days integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.second_step_done() or not public.has_staff_role('billing') then
    raise exception 'Only billing staff and admins can see why members cancel' using errcode = 'insufficient_privilege';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Choose from 1 to 365 days' using errcode = 'invalid_parameter_value';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'reason', r.reason,
             'answers', r.answers,
             'kept', r.kept,
             -- The offers that kept members: {"pause": 3, "credit": 1}.
             'kept_by', coalesce((
               select jsonb_object_agg(k.offer, k.n)
                 from (select c.offer, count(*) as n
                         from public.cancellation_feedback c
                        where c.reason = r.reason and c.outcome = 'kept' and c.offer is not null
                          and c.created_at >= now() - make_interval(days => p_days)
                        group by c.offer) k
             ), '{}'::jsonb)
           ) order by r.answers desc, r.reason)
      from (
        select c.reason, count(*) as answers, count(*) filter (where c.outcome = 'kept') as kept
          from public.cancellation_feedback c
         where c.created_at >= now() - make_interval(days => p_days)
         group by c.reason
      ) r
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.cancellation_reasons(integer) from public, anon;
grant execute on function public.cancellation_reasons(integer) to authenticated, service_role;

select cron.schedule('cancellation-feedback-cleanup', '50 3 * * *',
  $job$delete from public.cancellation_feedback where created_at < now() - interval '1 year'$job$);
