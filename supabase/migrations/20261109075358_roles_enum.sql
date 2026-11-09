-- Roles: 'admin' becomes 'master_admin'; new 'regional_admin'.
-- (Separate migration: new enum values cannot be used in the same transaction.)
alter type public.user_role rename value 'admin' to 'master_admin';
alter type public.user_role add value if not exists 'regional_admin';
