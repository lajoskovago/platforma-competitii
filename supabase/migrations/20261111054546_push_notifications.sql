-- =============================================================================
-- Web push notifications (referees / table officials).
-- One row per device (browser) that turned notifications on. Each user manages
-- their own devices; the server sends with the service role.
-- =============================================================================
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "own_read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own_insert" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "own_update" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_delete" on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;
revoke all on public.push_subscriptions from anon;

-- Day-before reminder is sent once per confirmed nomination
alter table public.game_officials add column reminder_sent_at timestamptz;
