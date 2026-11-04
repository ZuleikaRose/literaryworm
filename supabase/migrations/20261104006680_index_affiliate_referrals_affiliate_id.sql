-- The affiliate referrals' foreign key to affiliates (6679). One statement, so it can run outside a transaction.
create index concurrently if not exists affiliate_referrals_affiliate_id on public.affiliate_referrals (affiliate_id);
