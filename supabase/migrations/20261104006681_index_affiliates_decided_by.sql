-- Who decided an affiliate application (6679). One statement, so it can run outside a transaction.
create index concurrently if not exists affiliates_decided_by on public.affiliates (decided_by);
