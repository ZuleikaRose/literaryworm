-- The events the team has to look at (disputes, refunds, fraud warnings). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists stripe_events_needs_review_idx
  on public.stripe_events (received_at) where needs_review;
