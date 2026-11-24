-- A Stripe balance transaction is a friend's credit on one referral only. Applied outside a transaction
-- (CONCURRENTLY), on its own; record_referral_transaction() refuses a reused id either way.
create unique index concurrently if not exists referrals_friend_credit_id_key on public.referrals (friend_credit_id) where friend_credit_id is not null;
