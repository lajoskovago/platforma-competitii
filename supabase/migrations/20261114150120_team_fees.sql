-- What is charged for the officials of a game: a fixed amount per game for each category
-- (championship), no longer the sum of the nominated officials' rates.
-- Per game (game_charges.payer): one team pays it all (home or away) or it is split in half.
-- The officials are paid from what the teams paid (any surplus stays with the region).
create table public.team_fees (
  category_id  uuid primary key references public.categories (id) on delete cascade,
  amount       numeric(10, 2) not null check (amount >= 0),
  updated_at   timestamptz not null default now()
);

alter table public.team_fees enable row level security;
create policy "nominators_read" on public.team_fees for select to authenticated using (public.can_nominate_any());
create policy "master_write" on public.team_fees for all to authenticated
  using (public.is_master_admin()) with check (public.is_master_admin());
grant select, insert, update, delete on public.team_fees to authenticated, service_role;
revoke all on public.team_fees from anon;

-- one team pays all: the home team or (new) the away team
alter table public.game_charges drop constraint if exists game_charges_payer_check;
alter table public.game_charges add constraint game_charges_payer_check check (payer in ('home', 'away', 'both'));

-- per-game team amounts are no longer used (amounts come from the category)
update public.game_charges set home_amount = null, away_amount = null
 where home_amount is not null or away_amount is not null;
