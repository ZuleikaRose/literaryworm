-- Gift memberships (new request).
--
-- A member pays once on Stripe Checkout for 1, 3, 6 or 12 months of a plan; the
-- stripe-webhook function then makes a gift code (16 letters and digits, with
-- no 0/O or 1/I so it's easy to read out) and keeps it here. The buyer sees
-- their codes; nobody else can read them. Whoever has the code redeems it once
-- in Account, through the manage-account function: Stripe gives their
-- membership the free months (a trial, so nothing is charged), and the webhook
-- writes the membership as usual. Codes don't expire.
--
-- Rows are written only by the functions (service role): never from the browser.

create table public.gift_codes (
  id                         uuid primary key default gen_random_uuid(),
  code                       text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{16}$'),
  plan_id                    text not null references public.plans (id),
  months                     smallint not null check (months in (1, 3, 6, 12)),
  amount_cents               integer not null check (amount_cents > 0),
  currency                   char(3) not null default 'USD',
  -- Kept when the buyer deletes their account, so a code already given still works.
  buyer_id                   uuid references auth.users (id) on delete set null,
  stripe_checkout_session_id text not null unique check (stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
  redeemed_by                uuid references auth.users (id) on delete set null,
  redeemed_at                timestamptz,
  created_at                 timestamptz not null default now(),
  -- Who redeemed it is cleared if they delete their account; when stays, so it can't be used again.
  check (redeemed_by is null or redeemed_at is not null)
);
-- Foreign key indexes are in the 2701–2703 migrations (CREATE INDEX CONCURRENTLY runs outside a transaction).

alter table public.gift_codes enable row level security;
create policy "Buyers see the gifts they bought" on public.gift_codes for select to authenticated
  using (buyer_id = (select auth.uid()));
create policy "Two-step sign-in when turned on" on public.gift_codes as restrictive for all to authenticated
  using ((select public.second_step_done())) with check ((select public.second_step_done()));
revoke all on public.gift_codes from anon, authenticated;
-- Not the Stripe session or who redeemed it: only whether and when.
grant select (id, code, plan_id, months, amount_cents, currency, redeemed_at, created_at) on public.gift_codes to authenticated;

-- subscriptions.gift_until: the end of the free months a gift gave, while
-- they last (from the Stripe subscription's metadata, written by the webhook).
-- Account shows it, and the billing day can't move until it's passed.
alter table public.subscriptions add column gift_until timestamptz;
grant select (gift_until) on public.subscriptions to authenticated;
