-- reading_plans.user_id, for RLS (migration 6570). One statement: CONCURRENTLY can't run in a transaction.
create index concurrently if not exists reading_plans_user_id_idx on public.reading_plans (user_id);
