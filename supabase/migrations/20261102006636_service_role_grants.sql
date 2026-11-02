-- The Edge Functions use the service role. Production's tables have always granted it full
-- access through Supabase's default privileges, but newer projects and branches (such as the dev
-- branch, literaryworm-dev) no longer grant it by default, so there every function that reads or
-- writes a table failed with "permission denied" (found 2 November 2026 testing `discussion`).
-- This grants it explicitly, which changes nothing where it was already granted, and makes it the
-- default for tables created from now on. Row Level Security is unaffected: the service role
-- bypasses it as before, and browser roles keep only their own column grants.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
-- Production's service role can also run every public function (the dev branch couldn't run 24).
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
