-- Stripe billing.
--
-- Members pay through Stripe Checkout (Stripe-hosted, so card details never
-- reach LiteraryWorm). The checkout Edge Function creates a Stripe Customer and
-- a Checkout Session; the stripe-webhook function keeps public.subscriptions in
-- step with Stripe. The two tables have RLS on and no browser access at all
-- (only the functions, with the service role, read and write them).
--
-- public.stripe_customers   which Stripe Customer belongs to which account
--                            (events are mapped to accounts through it, not
--                            through metadata)
-- public.stripe_events      every webhook event once (repeats are skipped),
--                            with disputes, refunds and fraud warnings kept for
--                            the team to act on
-- subscriptions.stripe_linked  whether the membership is billed through Stripe,
--                            so the app can ask unlinked members to add a
--                            payment method without seeing Stripe's ids

create table public.stripe_customers (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  customer_id text not null unique check (customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at  timestamptz not null default now()
);

create table public.stripe_events (
  id          text primary key check (id ~ '^evt_[A-Za-z0-9]+$'),
  type        text not null check (char_length(type) between 1 and 120),
  object_id   text,
  livemode    boolean not null,
  needs_review boolean not null default false,  -- disputes, refunds, early fraud warnings
  received_at timestamptz not null default now()
);
-- Indexes are in the 1901 and 1902 migrations (CREATE INDEX CONCURRENTLY runs outside a transaction).

alter table public.stripe_customers enable row level security;
alter table public.stripe_events enable row level security;
revoke all on public.stripe_customers, public.stripe_events from anon, authenticated;

alter table public.subscriptions
  add column stripe_linked boolean generated always as (stripe_subscription_id is not null) stored;
grant select (stripe_linked) on public.subscriptions to authenticated;
