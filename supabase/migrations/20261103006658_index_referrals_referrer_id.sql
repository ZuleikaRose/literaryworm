-- The foreign key referrals.referrer_id (6657; referred_id is unique, account_id the codes' primary key).
create index concurrently if not exists referrals_referrer_id_idx on public.referrals (referrer_id);
