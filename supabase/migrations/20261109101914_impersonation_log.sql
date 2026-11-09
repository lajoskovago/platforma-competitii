-- Audit trail for support impersonation (master admin acting as another user).
-- Rows are written by the server with the service role; only master admins read them.
create table public.impersonation_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles (id) on delete set null,
  target_id   uuid references public.profiles (id) on delete set null,
  admin_email text not null,
  target_email text not null,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index on public.impersonation_log (started_at desc);

alter table public.impersonation_log enable row level security;
create policy "master_read" on public.impersonation_log for select to authenticated
  using (public.is_master_admin());

grant select on public.impersonation_log to authenticated;
grant select, insert, update, delete on public.impersonation_log to service_role;
revoke all on public.impersonation_log from anon;
