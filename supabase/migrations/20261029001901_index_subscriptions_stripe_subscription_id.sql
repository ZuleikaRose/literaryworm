-- A Stripe subscription belongs to one account. Kept to one statement: CONCURRENTLY can't run in a transaction.
create unique index concurrently if not exists subscriptions_stripe_subscription_id_key
  on public.subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;
