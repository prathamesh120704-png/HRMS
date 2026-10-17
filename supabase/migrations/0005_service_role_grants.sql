-- Newer Supabase projects do not automatically grant the API roles access to tables created in SQL.
-- The service_role is used ONLY by server-only code (seed script, cron, email sender); it must never reach a browser
-- or the AI model (CLAUDE.md rule 8). anon and authenticated stay locked down by 0003 (select via RLS only).

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
