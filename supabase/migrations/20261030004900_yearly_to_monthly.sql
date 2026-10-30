-- Yearly to monthly at renewal (follow-up to yearly billing): a yearly member can choose monthly
-- billing from the day the year would renew. checkout puts a Stripe subscription schedule on the
-- subscription (the year as it is, then the monthly price); the stripe-webhook function records
-- the plan it moves to here, from Stripe, while the schedule is attached. Choosing yearly again
-- before then, or cancelling, drops it. Members read it; only the service role writes it.

alter table public.subscriptions add column switch_to_monthly text references public.plans (id);
-- Its foreign key index is in the 4901 migration.
grant select (switch_to_monthly) on public.subscriptions to authenticated;
