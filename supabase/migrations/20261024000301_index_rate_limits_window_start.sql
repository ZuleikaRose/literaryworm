-- Lets the rate-limit cleanup find old windows quickly. One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists rate_limits_window_start_idx on private.rate_limits (window_start);
