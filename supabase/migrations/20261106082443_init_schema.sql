-- =============================================================================
-- Competiții Regiunea 5 FRB — initial schema
--   Structure: category -> tournament -> group -> teams
--   Workflow:  hosting proposals (organise a tournament for a group)
--              -> responses from the other teams -> confirmation
--              -> games (program) -> results
-- All workflow mutations go through SECURITY DEFINER functions that check the
-- caller's rights; tables are otherwise read-only for normal users (RLS).
-- =============================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'user');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       citext not null unique,
  full_name   text not null default '',
  phone       text,
  role        public.user_role not null default 'user',
  created_at  timestamptz not null default now()
);

-- Create a profile row automatically for every new auth user.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Competition structure
-- ---------------------------------------------------------------------------
create type public.region as enum ('SR5', 'SR6');

create table public.clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  city        text,
  region      public.region,
  created_at  timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,            -- e.g. U12M
  name        text not null,                   -- e.g. U12 Masculin
  sort_order  int not null default 0
);

create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete restrict,
  category_id  uuid not null references public.categories (id) on delete restrict,
  name         text not null,                  -- display name, e.g. "U-BT Gri"
  created_at   timestamptz not null default now(),
  unique (category_id, name)
);
create index on public.teams (club_id);

create table public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories (id) on delete cascade,
  season       text not null default '2026-2027',
  number       int not null,                   -- Turneul 1, 2, ...
  name         text not null,                  -- e.g. "Turneul 1"
  period       text,                           -- e.g. "Noiembrie 2026"
  unique (category_id, season, number)
);

create table public.groups (
  id                     uuid primary key default gen_random_uuid(),
  tournament_id          uuid not null references public.tournaments (id) on delete cascade,
  name                   text not null,        -- e.g. "Grupa 1 (SR5)"
  region                 public.region,
  notes                  text,
  sort_order             int not null default 0,
  confirmed_proposal_id  uuid,                 -- FK added below
  unique (tournament_id, name)
);

create table public.group_teams (
  group_id  uuid not null references public.groups (id) on delete cascade,
  team_id   uuid not null references public.teams (id) on delete cascade,
  primary key (group_id, team_id)
);
create index on public.group_teams (team_id);

-- Who may act for which team
create table public.team_coaches (
  team_id  uuid not null references public.teams (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (team_id, user_id)
);
create index on public.team_coaches (user_id);

create table public.club_managers (
  club_id  uuid not null references public.clubs (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (club_id, user_id)
);
create index on public.club_managers (user_id);

-- ---------------------------------------------------------------------------
-- Gyms (list grows as coaches add them)
-- ---------------------------------------------------------------------------
create table public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text not null,
  address     text,
  maps_url    text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (name, city)
);

-- ---------------------------------------------------------------------------
-- Hosting proposals & responses
-- ---------------------------------------------------------------------------
create type public.proposal_status as enum (
  'pending',       -- waiting for the other teams / admin
  'confirmed',     -- this team organises the tournament
  'withdrawn',     -- proposer withdrew
  'not_selected'   -- admin chose another proposal
);

create table public.hosting_proposals (
  id                      uuid primary key default gen_random_uuid(),
  group_id                uuid not null references public.groups (id) on delete cascade,
  team_id                 uuid not null references public.teams (id) on delete cascade,
  proposed_by             uuid references public.profiles (id) on delete set null,
  gym_id                  uuid not null references public.gyms (id) on delete restrict,
  start_date              date not null,
  end_date                date,
  notes                   text,
  conditions_text         text not null,       -- the exact text that was accepted
  conditions_accepted_at  timestamptz not null default now(),
  status                  public.proposal_status not null default 'pending',
  confirmed_by_admin      boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index on public.hosting_proposals (group_id);

-- Only one live (pending/confirmed) proposal per team per group
create unique index hosting_proposals_one_live_per_team
  on public.hosting_proposals (group_id, team_id)
  where status in ('pending', 'confirmed');

alter table public.groups
  add constraint groups_confirmed_proposal_fk
  foreign key (confirmed_proposal_id) references public.hosting_proposals (id) on delete set null;

create type public.response_kind as enum ('accept', 'reject');

create table public.proposal_responses (
  proposal_id   uuid not null references public.hosting_proposals (id) on delete cascade,
  team_id       uuid not null references public.teams (id) on delete cascade,
  response      public.response_kind not null,
  reason        text,
  responded_by  uuid references public.profiles (id) on delete set null,
  responded_at  timestamptz not null default now(),
  primary key (proposal_id, team_id),
  check (response = 'accept' or (reason is not null and length(trim(reason)) > 0))
);

-- ---------------------------------------------------------------------------
-- Games & results
-- ---------------------------------------------------------------------------
create type public.game_status as enum (
  'scheduled',
  'played',
  'forfeit_home',  -- home team did not show up (0 points)
  'forfeit_away'   -- away team did not show up (0 points)
);

create table public.games (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups (id) on delete cascade,
  label         text,                          -- e.g. "Meci 1", "Semifinala 1"
  home_team_id  uuid references public.teams (id) on delete set null,
  away_team_id  uuid references public.teams (id) on delete set null,
  home_label    text,                          -- placeholder when team not known yet
  away_label    text,                          -- e.g. "Învinsă SF1"
  starts_at     timestamptz not null,
  gym_id        uuid references public.gyms (id) on delete set null,
  status        public.game_status not null default 'scheduled',
  home_score    int check (home_score >= 0),
  away_score    int check (away_score >= 0),
  updated_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  check (home_team_id is not null or home_label is not null),
  check (away_team_id is not null or away_label is not null),
  check (status <> 'played' or (home_score is not null and away_score is not null
                                and home_team_id is not null and away_team_id is not null))
);
create index on public.games (group_id, starts_at);

-- =============================================================================
-- Helper functions (used by RLS and workflow functions)
-- =============================================================================
create function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Teams the current user may act for: as coach, or as manager of the club.
create function public.my_team_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select team_id from public.team_coaches where user_id = auth.uid()
  union
  select t.id from public.teams t
    join public.club_managers cm on cm.club_id = t.club_id
   where cm.user_id = auth.uid();
$$;

create function public.can_act_for_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or p_team_id in (select public.my_team_ids());
$$;

-- The confirmed host team of a group (null if none yet).
create function public.group_host_team(p_group_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select hp.team_id from public.groups g
    join public.hosting_proposals hp on hp.id = g.confirmed_proposal_id
   where g.id = p_group_id;
$$;

create function public.can_manage_group_games(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or coalesce(public.group_host_team(p_group_id) in (select public.my_team_ids()), false);
$$;

create function public.app_conditions_text()
returns text language sql immutable as $$
  select 'Am luat la cunoștință îndatoririle mele ca organizator: să pun gratuit la dispoziție pentru celelalte echipe sala de joc și asistența medicală.'::text;
$$;

-- =============================================================================
-- Workflow functions
-- =============================================================================

-- Confirm a proposal automatically when every other team in the group accepted
-- it and it is the only live proposal in the group.
create function public._try_auto_confirm(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
  v_team  uuid;
  v_missing int;
  v_live int;
begin
  select group_id, team_id into v_group, v_team
    from public.hosting_proposals where id = p_proposal_id and status = 'pending';
  if v_group is null then return; end if;

  select count(*) into v_missing
    from public.group_teams gt
   where gt.group_id = v_group and gt.team_id <> v_team
     and not exists (select 1 from public.proposal_responses r
                      where r.proposal_id = p_proposal_id and r.team_id = gt.team_id
                        and r.response = 'accept');

  select count(*) into v_live from public.hosting_proposals
   where group_id = v_group and status in ('pending', 'confirmed');

  if v_missing = 0 and v_live = 1 then
    update public.hosting_proposals set status = 'confirmed', updated_at = now()
     where id = p_proposal_id;
    update public.groups set confirmed_proposal_id = p_proposal_id where id = v_group;
  end if;
end $$;

-- Coach: "Vreau să organizez"
create function public.create_proposal(
  p_group_id uuid,
  p_team_id uuid,
  p_gym_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null,
  p_conditions_accepted boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Neautentificat'; end if;
  if not public.can_act_for_team(p_team_id) then
    raise exception 'Nu aveți drept de acțiune pentru această echipă';
  end if;
  if not exists (select 1 from public.group_teams where group_id = p_group_id and team_id = p_team_id) then
    raise exception 'Echipa nu face parte din această grupă';
  end if;
  if not coalesce(p_conditions_accepted, false) then
    raise exception 'Trebuie să acceptați condițiile de organizare';
  end if;
  if exists (select 1 from public.groups where id = p_group_id and confirmed_proposal_id is not null) then
    raise exception 'Grupa are deja un organizator confirmat';
  end if;

  insert into public.hosting_proposals
    (group_id, team_id, proposed_by, gym_id, start_date, end_date, notes, conditions_text)
  values
    (p_group_id, p_team_id, auth.uid(), p_gym_id, p_start_date, p_end_date,
     nullif(trim(p_notes), ''), public.app_conditions_text())
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Echipa are deja o propunere activă în această grupă';
end $$;

-- Proposer changes date / gym. All responses are reset; a confirmed proposal
-- goes back to pending and the group loses its confirmed host until the other
-- teams accept again.
create function public.update_proposal(
  p_proposal_id uuid,
  p_gym_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
begin
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if not public.can_act_for_team(v_p.team_id) then raise exception 'Fără drepturi'; end if;
  if v_p.status not in ('pending', 'confirmed') then
    raise exception 'Propunerea nu mai este activă';
  end if;

  update public.hosting_proposals
     set gym_id = p_gym_id, start_date = p_start_date, end_date = p_end_date,
         notes = nullif(trim(p_notes), ''), status = 'pending',
         confirmed_by_admin = false, updated_at = now()
   where id = p_proposal_id;

  delete from public.proposal_responses where proposal_id = p_proposal_id;
  update public.groups set confirmed_proposal_id = null
   where id = v_p.group_id and confirmed_proposal_id = p_proposal_id;
end $$;

create function public.withdraw_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
  v_other uuid;
begin
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if not public.can_act_for_team(v_p.team_id) then raise exception 'Fără drepturi'; end if;
  if v_p.status not in ('pending', 'confirmed') then
    raise exception 'Propunerea nu mai este activă';
  end if;

  update public.hosting_proposals set status = 'withdrawn', updated_at = now()
   where id = p_proposal_id;
  update public.groups set confirmed_proposal_id = null
   where id = v_p.group_id and confirmed_proposal_id = p_proposal_id;

  -- If exactly one live proposal remains, it may now be auto-confirmed.
  for v_other in select id from public.hosting_proposals
                  where group_id = v_p.group_id and status = 'pending' loop
    perform public._try_auto_confirm(v_other);
  end loop;
end $$;

-- Other team: accept / reject (reason required on reject)
create function public.respond_to_proposal(
  p_proposal_id uuid,
  p_team_id uuid,
  p_response public.response_kind,
  p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
begin
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if v_p.status <> 'pending' then raise exception 'Propunerea nu mai așteaptă răspunsuri'; end if;
  if not public.can_act_for_team(p_team_id) then raise exception 'Fără drepturi'; end if;
  if p_team_id = v_p.team_id then raise exception 'Nu puteți răspunde propriei propuneri'; end if;
  if not exists (select 1 from public.group_teams where group_id = v_p.group_id and team_id = p_team_id) then
    raise exception 'Echipa nu face parte din această grupă';
  end if;
  if p_response = 'reject' and coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception 'Motivul respingerii este obligatoriu';
  end if;

  insert into public.proposal_responses (proposal_id, team_id, response, reason, responded_by, responded_at)
  values (p_proposal_id, p_team_id, p_response, nullif(trim(p_reason), ''), auth.uid(), now())
  on conflict (proposal_id, team_id) do update
     set response = excluded.response, reason = excluded.reason,
         responded_by = excluded.responded_by, responded_at = now();

  perform public._try_auto_confirm(p_proposal_id);
end $$;

-- Admin: choose the organiser (used when several teams want to organise,
-- or to override).
create function public.admin_confirm_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
begin
  if not public.is_admin() then raise exception 'Doar administratorii pot decide'; end if;
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if v_p.status not in ('pending', 'confirmed') then
    raise exception 'Propunerea nu mai este activă';
  end if;

  update public.hosting_proposals set status = 'not_selected', updated_at = now()
   where group_id = v_p.group_id and id <> p_proposal_id and status in ('pending', 'confirmed');
  update public.hosting_proposals
     set status = 'confirmed', confirmed_by_admin = true, updated_at = now()
   where id = p_proposal_id;
  update public.groups set confirmed_proposal_id = p_proposal_id where id = v_p.group_id;
end $$;

-- Admin: undo a confirmation (back to pending)
create function public.admin_unconfirm_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Doar administratorii'; end if;
  update public.hosting_proposals hp set status = 'pending', confirmed_by_admin = false, updated_at = now()
    from public.groups g
   where g.id = p_group_id and hp.id = g.confirmed_proposal_id;
  update public.groups set confirmed_proposal_id = null where id = p_group_id;
end $$;

-- Keep games.updated_at / updated_by current
create function public.touch_game()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger games_touch before insert or update on public.games
  for each row execute function public.touch_game();

-- Games must involve teams of the group
create function public.check_game_teams()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.home_team_id is not null and not exists
     (select 1 from public.group_teams where group_id = new.group_id and team_id = new.home_team_id) then
    raise exception 'Echipa gazdă nu face parte din grupă';
  end if;
  if new.away_team_id is not null and not exists
     (select 1 from public.group_teams where group_id = new.group_id and team_id = new.away_team_id) then
    raise exception 'Echipa oaspete nu face parte din grupă';
  end if;
  return new;
end $$;

create trigger games_check_teams before insert or update on public.games
  for each row execute function public.check_game_teams();

-- =============================================================================
-- Views
-- =============================================================================

-- Standings per group: 2 pts win, 1 pt loss, 0 pts forfeit (FRB).
create view public.group_standings with (security_invoker = true) as
with results as (
  select g.group_id, g.home_team_id as team_id,
         case when g.status = 'played' and g.home_score > g.away_score then 1
              when g.status = 'forfeit_away' then 1 else 0 end as won,
         case when g.status = 'played' and g.home_score < g.away_score then 1 else 0 end as lost,
         case when g.status = 'forfeit_home' then 1 else 0 end as forfeit,
         case when g.status = 'played' then g.home_score else 0 end as pf,
         case when g.status = 'played' then g.away_score else 0 end as pa
    from public.games g where g.status <> 'scheduled' and g.home_team_id is not null
  union all
  select g.group_id, g.away_team_id,
         case when g.status = 'played' and g.away_score > g.home_score then 1
              when g.status = 'forfeit_home' then 1 else 0 end,
         case when g.status = 'played' and g.away_score < g.home_score then 1 else 0 end,
         case when g.status = 'forfeit_away' then 1 else 0 end,
         case when g.status = 'played' then g.away_score else 0 end,
         case when g.status = 'played' then g.home_score else 0 end
    from public.games g where g.status <> 'scheduled' and g.away_team_id is not null
)
select gt.group_id, gt.team_id,
       coalesce(sum(r.won + r.lost + r.forfeit), 0)::int as played,
       coalesce(sum(r.won), 0)::int  as won,
       coalesce(sum(r.lost + r.forfeit), 0)::int as lost,
       coalesce(sum(r.pf), 0)::int   as points_for,
       coalesce(sum(r.pa), 0)::int   as points_against,
       coalesce(sum(2 * r.won + r.lost), 0)::int as points
  from public.group_teams gt
  left join results r on r.group_id = gt.group_id and r.team_id = gt.team_id
 group by gt.group_id, gt.team_id;

-- One status per group for dashboards
create view public.group_overview with (security_invoker = true) as
select g.id as group_id,
       g.name as group_name,
       g.region,
       g.sort_order,
       t.id as tournament_id,
       t.name as tournament_name,
       c.id as category_id,
       c.code as category_code,
       c.name as category_name,
       c.sort_order as category_sort,
       g.confirmed_proposal_id,
       (select count(*) from public.hosting_proposals hp
         where hp.group_id = g.id and hp.status = 'pending')::int as pending_count,
       (select count(*) from public.games gm where gm.group_id = g.id)::int as games_count,
       (select count(*) from public.games gm
         where gm.group_id = g.id and gm.status <> 'scheduled')::int as games_done,
       case
         when g.confirmed_proposal_id is null then
           case (select count(*) from public.hosting_proposals hp
                  where hp.group_id = g.id and hp.status = 'pending')
             when 0 then 'no_proposal'
             when 1 then 'waiting'
             else 'conflict' end
         when not exists (select 1 from public.games gm where gm.group_id = g.id) then 'confirmed'
         when exists (select 1 from public.games gm where gm.group_id = g.id and gm.status = 'scheduled')
           then 'scheduled'
         else 'finished'
       end as status
  from public.groups g
  join public.tournaments t on t.id = g.tournament_id
  join public.categories c on c.id = t.category_id;

-- =============================================================================
-- Row Level Security
--   Read: every logged-in user can read competition data (it will be public
--         later anyway). Profiles readable by logged-in users (coach contacts).
--   Write: admins directly; coaches only via workflow functions, plus games
--          for the confirmed host, plus adding gyms.
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.clubs               enable row level security;
alter table public.categories          enable row level security;
alter table public.teams               enable row level security;
alter table public.tournaments         enable row level security;
alter table public.groups              enable row level security;
alter table public.group_teams         enable row level security;
alter table public.team_coaches        enable row level security;
alter table public.club_managers       enable row level security;
alter table public.gyms                enable row level security;
alter table public.hosting_proposals   enable row level security;
alter table public.proposal_responses  enable row level security;
alter table public.games               enable row level security;

-- Read access for authenticated users
do $$
declare t text;
begin
  foreach t in array array['profiles','clubs','categories','teams','tournaments','groups',
                           'group_teams','team_coaches','club_managers','gyms',
                           'hosting_proposals','proposal_responses','games'] loop
    execute format('create policy "read_authenticated" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

-- Admin full write access to structure tables
do $$
declare t text;
begin
  foreach t in array array['profiles','clubs','categories','teams','tournaments','groups',
                           'group_teams','team_coaches','club_managers','gyms',
                           'hosting_proposals','proposal_responses','games'] loop
    execute format('create policy "admin_insert" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin_update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "admin_delete" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Users can update their own name/phone (role change blocked by trigger below)
create policy "own_profile_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Not SECURITY DEFINER on purpose: current_user must be the caller's role.
create function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.email is distinct from old.email)
     and current_user in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'Nu puteți modifica rolul sau emailul';
  end if;
  return new;
end $$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Any logged-in user can add a gym
create policy "user_insert_gym" on public.gyms for insert to authenticated
  with check (created_by = auth.uid());

-- Confirmed host (or admin) manages games of the group
create policy "host_insert_games" on public.games for insert to authenticated
  with check (public.can_manage_group_games(group_id));
create policy "host_update_games" on public.games for update to authenticated
  using (public.can_manage_group_games(group_id))
  with check (public.can_manage_group_games(group_id));
create policy "host_delete_games" on public.games for delete to authenticated
  using (public.can_manage_group_games(group_id));

-- Workflow functions: callable by logged-in users only
revoke execute on function public._try_auto_confirm(uuid) from public, anon, authenticated;
revoke execute on function public.create_proposal(uuid, uuid, uuid, date, date, text, boolean) from public, anon;
revoke execute on function public.update_proposal(uuid, uuid, date, date, text) from public, anon;
revoke execute on function public.withdraw_proposal(uuid) from public, anon;
revoke execute on function public.respond_to_proposal(uuid, uuid, public.response_kind, text) from public, anon;
revoke execute on function public.admin_confirm_proposal(uuid) from public, anon;
revoke execute on function public.admin_unconfirm_group(uuid) from public, anon;
