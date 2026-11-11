-- =============================================================================
-- Officials' payments ("Decont") – games played in Oradea (regional + national).
--   fee_rates           amount per category + position (set by the master admin)
--   game_officials      .fee_override: per-nomination amount, overrides the rate
--   game_charges        who pays the officials of a game (home only / both teams),
--                       optional custom amounts, and whether each team has paid
--   official_payouts    money handed to an official (balances may go negative)
-- Read: master admin and nominators (admins / delegates); officials read their own
-- payouts. Write: master admin only. Balances are computed on the server.
-- =============================================================================

create table public.fee_rates (
  category_id  uuid not null references public.categories (id) on delete cascade,
  position     public.official_position not null,
  amount       numeric(10, 2) not null check (amount >= 0),
  updated_at   timestamptz not null default now(),
  primary key (category_id, position)
);

alter table public.game_officials add column fee_override numeric(10, 2) check (fee_override >= 0);

create table public.game_charges (
  game_id         uuid primary key references public.games (id) on delete cascade,
  payer           text check (payer in ('home', 'both')),       -- null = default by competition
  home_amount     numeric(10, 2) check (home_amount >= 0),       -- null = computed
  away_amount     numeric(10, 2) check (away_amount >= 0),
  home_paid_on    date,
  home_paid_note  text,
  away_paid_on    date,
  away_paid_note  text,
  updated_at      timestamptz not null default now()
);

create table public.official_payouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      numeric(10, 2) not null check (amount > 0),
  paid_on     date not null default current_date,
  note        text,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index on public.official_payouts (user_id, paid_on);

alter table public.fee_rates enable row level security;
alter table public.game_charges enable row level security;
alter table public.official_payouts enable row level security;

create policy "nominators_read" on public.fee_rates for select to authenticated using (public.can_nominate_any());
create policy "master_write" on public.fee_rates for all to authenticated
  using (public.is_master_admin()) with check (public.is_master_admin());

create policy "nominators_read" on public.game_charges for select to authenticated using (public.can_nominate_any());
create policy "master_write" on public.game_charges for all to authenticated
  using (public.is_master_admin()) with check (public.is_master_admin());

create policy "own_or_nominators_read" on public.official_payouts for select to authenticated
  using (user_id = auth.uid() or public.can_nominate_any());
create policy "master_write" on public.official_payouts for all to authenticated
  using (public.is_master_admin()) with check (public.is_master_admin());

grant select, insert, update, delete on public.fee_rates, public.game_charges, public.official_payouts
  to authenticated, service_role;
revoke all on public.fee_rates, public.game_charges, public.official_payouts from anon;

-- Only the master admin sets a nomination's fee (nominators may update other columns)
create or replace function public.protect_fee_override()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.fee_override is distinct from old.fee_override
     and current_user in ('authenticated', 'anon')
     and not public.is_master_admin() then
    raise exception 'Doar administratorul principal poate modifica suma';
  end if;
  return new;
end $$;

create trigger game_officials_protect_fee before update on public.game_officials
  for each row execute function public.protect_fee_override();
