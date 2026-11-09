-- =============================================================================
-- Explicit privileges for the API roles.
-- Newer hosted Supabase projects do not grant table / function privileges to
-- `authenticated` and `service_role` automatically (local dev does), which made
-- every query fail with "permission denied for table ...".
-- Access control stays with Row Level Security (enabled on every table) and the
-- checks inside the SECURITY DEFINER workflow functions.
-- `anon` (logged-out visitors) gets nothing: there are no public pages yet.
-- =============================================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- same for objects created by later migrations
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;

-- internal helpers must not be callable directly through the API
revoke execute on function public._try_auto_confirm(uuid) from authenticated;
revoke execute on function public._auto_confirm_if_active(uuid) from authenticated;

-- logged-out visitors: no direct access to data or workflow functions
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
