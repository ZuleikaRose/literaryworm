-- The 48-hour cancellation rule (Terms and Return Policy): a member must cancel at least
-- 48 hours before the next billing date to stop that charge. Cancelling later still ends
-- the membership, but after one more paid month; nothing is refunded either way.
--
-- subscriptions.cancel_at is when an ending membership ends: the period's end
-- (current_period_end) given 48 hours' notice, or a month after it otherwise. Written by
-- manage-account and the stripe-webhook function (from the Stripe subscription's
-- cancel_at); the browser only reads it. cancel_at_period_end stays true for any ending
-- membership. Memberships already ending end at their period's end.

alter table public.subscriptions add column cancel_at timestamptz;

update public.subscriptions
set cancel_at = current_period_end
where cancel_at_period_end and cancel_at is null;

grant select (cancel_at) on public.subscriptions to authenticated;
