-- A Sales staff role. Its own migration: a new enum value can't be used in the transaction
-- that adds it, and migration 3601 uses it. Like Developer, Customer service and Blog, no
-- tool checks it yet; it gives a complimentary membership like every staff role (3601).
alter type public.staff_role add value if not exists 'sales';
