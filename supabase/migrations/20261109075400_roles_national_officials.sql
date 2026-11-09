-- =============================================================================
-- Roles, visibility, national championship, referees & table officials
--
--   master_admin    everything
--   regional_admin  (region SR5/SR6) all regional/zonal groups; intervenes in
--                   groups of own region (+ mixed groups); national games of own
--                   region; manages clubs, club admins, coaches, officials
--   user            club admin (club_managers) and/or coach (team_coaches)
--                   -> sees championships (categories) where their teams play,
--                      national games of their teams
--   official        user with is_referee / is_table_official (+ region)
--                   -> sees all regional games, national games of own region,
--                      answers nominations, manages own unavailability
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: region + official flags
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column region public.region,
  add column is_referee boolean not null default false,
  add column is_table_official boolean not null default false;

alter table public.profiles
  add constraint profiles_regional_admin_region
    check (role <> 'regional_admin' or region is not null),
  add constraint profiles_official_region
    check ((not is_referee and not is_table_official) or region is not null);

-- ---------------------------------------------------------------------------
-- Role helpers (replace the old 'admin' based ones)
-- ---------------------------------------------------------------------------
create or replace function public.is_master_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'master_admin');
$$;

-- Any administrator (master or regional)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                  where id = auth.uid() and role in ('master_admin', 'regional_admin'));
$$;

create or replace function public.is_official()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                  where id = auth.uid() and (is_referee or is_table_official));
$$;

create or replace function public.my_region()
returns public.region language sql stable security definer set search_path = '' as $$
  select region from public.profiles where id = auth.uid();
$$;

-- Master admin, or regional admin of that region. A null region (mixed SR5+SR6
-- group) can be administered by both regional admins.
create or replace function public.can_admin_region(p_region public.region)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                  where id = auth.uid()
                    and (role = 'master_admin'
                         or (role = 'regional_admin' and (p_region is null or region = p_region))));
$$;

-- Acting for a team: coach / club admin of it, or an admin of the club's region
create or replace function public.can_act_for_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_team_id in (select public.my_team_ids())
      or public.can_admin_region((select c.region from public.teams t
                                    join public.clubs c on c.id = t.club_id
                                   where t.id = p_team_id));
$$;

-- ---------------------------------------------------------------------------
-- Visibility helpers
-- ---------------------------------------------------------------------------

-- Regional championship (category) visible: admins & officials see all,
-- coaches / club admins see the categories where one of their teams plays.
create or replace function public.can_view_regional_category(p_category_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.is_official()
      or exists (select 1 from public.teams t
                  where t.category_id = p_category_id
                    and t.id in (select public.my_team_ids()));
$$;

create or replace function public.can_view_group(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_view_regional_category(
    (select t.category_id from public.groups g
       join public.tournaments t on t.id = g.tournament_id
      where g.id = p_group_id));
$$;

-- Region of the group (null = mixed)
create or replace function public.group_region(p_group_id uuid)
returns public.region language sql stable security definer set search_path = '' as $$
  select region from public.groups where id = p_group_id;
$$;

-- Confirmed host or admin of the group's region manages regional games
create or replace function public.can_manage_group_games(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_admin_region(public.group_region(p_group_id))
      or coalesce(public.group_host_team(p_group_id) in (select public.my_team_ids()), false);
$$;

create or replace function public.admin_confirm_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
begin
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if not public.can_admin_region(public.group_region(v_p.group_id)) then
    raise exception 'Doar administratorii regiunii pot decide';
  end if;
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

create or replace function public.admin_unconfirm_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_admin_region(public.group_region(p_group_id)) then
    raise exception 'Doar administratorii regiunii';
  end if;
  update public.hosting_proposals hp set status = 'pending', confirmed_by_admin = false, updated_at = now()
    from public.groups g
   where g.id = p_group_id and hp.id = g.confirmed_proposal_id;
  update public.groups set confirmed_proposal_id = null where id = p_group_id;
end $$;

-- ---------------------------------------------------------------------------
-- Categories: regional vs national
-- ---------------------------------------------------------------------------
create type public.category_scope as enum ('regional', 'national');

alter table public.categories
  add column scope public.category_scope not null default 'regional';
alter table public.categories drop constraint categories_code_key;
alter table public.categories add constraint categories_scope_code_key unique (scope, code);

insert into public.categories (scope, code, name, sort_order) values
  ('national', 'U13M', 'U13 Masculin', 101), ('national', 'U13F', 'U13 Feminin', 102),
  ('national', 'U14M', 'U14 Masculin', 103), ('national', 'U14F', 'U14 Feminin', 104),
  ('national', 'U15M', 'U15 Masculin', 105), ('national', 'U15F', 'U15 Feminin', 106),
  ('national', 'U16M', 'U16 Masculin', 107), ('national', 'U16F', 'U16 Feminin', 108),
  ('national', 'U17M', 'U17 Masculin', 109), ('national', 'U17F', 'U17 Feminin', 110),
  ('national', 'U18M', 'U18 Masculin', 111), ('national', 'U18F', 'U18 Feminin', 112),
  ('national', 'L1M',  'Liga 1 Masculin', 113), ('national', 'L1F',  'Liga 1 Feminin', 114),
  ('national', 'LNBM', 'Liga Națională Masculin', 115), ('national', 'LNBF', 'Liga Națională Feminin', 116),
  ('national', 'CRBM', 'Cupa României Masculin', 117), ('national', 'CRBF', 'Cupa României Feminin', 118)
on conflict (scope, code) do nothing;

-- Opponents from outside the region (free text, remembered for autocomplete)
create table public.external_clubs (
  id          uuid primary key default gen_random_uuid(),
  name        citext not null unique,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Games: regional (in a group) or national (standalone)
-- ---------------------------------------------------------------------------
create type public.game_competition as enum ('regional', 'national');

alter table public.games
  alter column group_id drop not null,
  add column competition public.game_competition not null default 'regional',
  add column category_id uuid references public.categories (id) on delete restrict,
  add column region public.region,
  add column home_external text,
  add column away_external text,
  add column created_by uuid references public.profiles (id) on delete set null default auth.uid();

-- existing regional games: fill category from their group
update public.games g set category_id = t.category_id
  from public.groups gr join public.tournaments t on t.id = gr.tournament_id
 where gr.id = g.group_id;

alter table public.games
  drop constraint games_check1,
  drop constraint games_check2,
  drop constraint games_check3,
  add constraint games_home_side
    check (home_team_id is not null or home_label is not null or home_external is not null),
  add constraint games_away_side
    check (away_team_id is not null or away_label is not null or away_external is not null),
  add constraint games_played_needs_score
    check (status <> 'played' or (home_score is not null and away_score is not null
           and (home_team_id is not null or home_external is not null)
           and (away_team_id is not null or away_external is not null))),
  add constraint games_competition_shape
    check ((competition = 'regional' and group_id is not null)
        or (competition = 'national' and group_id is null and category_id is not null and region is not null));

create index on public.games (competition, starts_at);
create index on public.games (category_id);

-- Region of any game (regional games: the group's region, may be null = mixed)
create or replace function public.game_region_of(p_competition public.game_competition, p_group_id uuid, p_region public.region)
returns public.region language sql stable security definer set search_path = '' as $$
  select case when p_competition = 'national' then p_region else public.group_region(p_group_id) end;
$$;

create or replace function public.can_view_game_row(
  p_competition public.game_competition, p_group_id uuid, p_region public.region,
  p_home uuid, p_away uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_competition = 'regional' then public.can_view_group(p_group_id)
    else public.is_master_admin()
      or ((public.is_admin() or public.is_official()) and public.my_region() = p_region)
      or p_home in (select public.my_team_ids())
      or p_away in (select public.my_team_ids())
  end;
$$;

create or replace function public.can_manage_game_row(
  p_competition public.game_competition, p_group_id uuid, p_region public.region,
  p_home uuid, p_away uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_competition = 'regional' then public.can_manage_group_games(p_group_id)
    else public.can_admin_region(p_region)
      or p_home in (select public.my_team_ids())
      or p_away in (select public.my_team_ids())
  end;
$$;

create or replace function public.can_view_game(p_game_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.can_view_game_row(competition, group_id, region, home_team_id, away_team_id)
                     from public.games where id = p_game_id), false);
$$;

create or replace function public.game_region(p_game_id uuid)
returns public.region language sql stable security definer set search_path = '' as $$
  select public.game_region_of(competition, group_id, region) from public.games where id = p_game_id;
$$;

-- Validate teams; fill category / region
create or replace function public.check_game_teams()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.competition = 'regional' then
    select t.category_id into new.category_id
      from public.groups g join public.tournaments t on t.id = g.tournament_id
     where g.id = new.group_id;
    if new.home_team_id is not null and not exists
       (select 1 from public.group_teams where group_id = new.group_id and team_id = new.home_team_id) then
      raise exception 'Echipa gazdă nu face parte din grupă';
    end if;
    if new.away_team_id is not null and not exists
       (select 1 from public.group_teams where group_id = new.group_id and team_id = new.away_team_id) then
      raise exception 'Echipa oaspete nu face parte din grupă';
    end if;
  else
    if new.home_team_id is not null and not exists
       (select 1 from public.teams where id = new.home_team_id and category_id = new.category_id) then
      raise exception 'Echipa gazdă nu este înscrisă în această categorie';
    end if;
    if new.away_team_id is not null and not exists
       (select 1 from public.teams where id = new.away_team_id and category_id = new.category_id) then
      raise exception 'Echipa oaspete nu este înscrisă în această categorie';
    end if;
    if new.home_team_id is not null then new.home_external := null; end if;
    if new.away_team_id is not null then new.away_external := null; end if;
    -- region defaults to the region of our club playing the game
    if new.region is null then
      select c.region into new.region from public.teams t join public.clubs c on c.id = t.club_id
       where t.id = coalesce(new.home_team_id, new.away_team_id);
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Referees & table officials: nominations and unavailability
-- ---------------------------------------------------------------------------
create type public.official_position as enum (
  'referee_1', 'referee_2', 'referee_3',
  'scorer', 'assistant_scorer', 'timekeeper', 'shot_clock',
  'statistician_1', 'statistician_2', 'statistician_3'
);
create type public.nomination_status as enum ('pending', 'accepted', 'rejected');

create table public.game_officials (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games (id) on delete cascade,
  position      public.official_position not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        public.nomination_status not null default 'pending',
  reason        text,
  nominated_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  nominated_at  timestamptz not null default now(),
  responded_at  timestamptz,
  unique (game_id, position),
  check (status <> 'rejected' or (reason is not null and length(trim(reason)) > 0))
);
create index on public.game_officials (user_id);
-- one person cannot hold two active positions in the same game
create unique index game_officials_one_active_per_person
  on public.game_officials (game_id, user_id) where status <> 'rejected';

create or replace function public.check_nomination()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ref boolean;
  v_to boolean;
begin
  select is_referee, is_table_official into v_ref, v_to from public.profiles where id = new.user_id;
  if new.position in ('referee_1', 'referee_2', 'referee_3') and not coalesce(v_ref, false) then
    raise exception 'Persoana aleasă nu este arbitru';
  end if;
  if new.position not in ('referee_1', 'referee_2', 'referee_3') and not coalesce(v_to, false) then
    raise exception 'Persoana aleasă nu este oficial de masă';
  end if;
  -- a new person on the position starts a fresh nomination
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
    new.status := 'pending';
    new.reason := null;
    new.responded_at := null;
    new.nominated_at := now();
    new.nominated_by := auth.uid();
  end if;
  return new;
end $$;

create trigger game_officials_check before insert or update on public.game_officials
  for each row execute function public.check_nomination();

-- Official answers own nomination (reason required on reject)
create or replace function public.respond_to_nomination(
  p_nomination_id uuid,
  p_response public.nomination_status,
  p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_n public.game_officials;
begin
  select * into v_n from public.game_officials where id = p_nomination_id;
  if v_n.id is null or v_n.user_id <> auth.uid() then raise exception 'Nominalizare inexistentă'; end if;
  if p_response not in ('accepted', 'rejected') then raise exception 'Răspuns invalid'; end if;
  if p_response = 'rejected' and coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception 'Motivul refuzului este obligatoriu';
  end if;
  update public.game_officials
     set status = p_response,
         reason = case when p_response = 'rejected' then trim(p_reason) else null end,
         responded_at = now()
   where id = p_nomination_id;
end $$;

create table public.official_unavailability (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  start_date  date not null,
  end_date    date not null,
  start_time  time,
  end_time    time,
  note        text,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date),
  -- hours only for a single day
  check ((start_time is null and end_time is null) or start_date = end_date),
  check (start_time is null or end_time is null or end_time > start_time)
);
create index on public.official_unavailability (user_id, start_date);

-- Public names (no contact data) for showing coaches / officials to each other
create view public.profile_names as
  select id, full_name, region, is_referee, is_table_official from public.profiles;
revoke all on public.profile_names from anon;
grant select on public.profile_names to authenticated;

-- Contact details: self, admins, and coaches / club admins of teams in
-- groups the caller can see (only for callers who are coaches / club admins).
create or replace function public.can_view_profile(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_target = auth.uid()
      or public.is_admin()
      or (exists (select 1 from public.my_team_ids())
          and exists (
            select 1
              from public.group_teams gt
              join public.teams t on t.id = gt.team_id
             where public.can_view_group(gt.group_id)
               and (exists (select 1 from public.team_coaches tc where tc.team_id = t.id and tc.user_id = p_target)
                    or exists (select 1 from public.club_managers cm where cm.club_id = t.club_id and cm.user_id = p_target))));
$$;

-- Profile protection: role changes only by master admin; region / official
-- flags / email only by admins; regional admins cannot edit other admins.
-- Not SECURITY DEFINER: current_user must be the caller's role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new; -- service role / migrations
  end if;
  if new.role is distinct from old.role and not public.is_master_admin() then
    raise exception 'Doar administratorul principal poate schimba rolul';
  end if;
  if (new.email, new.region, new.is_referee, new.is_table_official)
       is distinct from (old.email, old.region, old.is_referee, old.is_table_official)
     and not public.is_admin() then
    raise exception 'Nu puteți modifica aceste date';
  end if;
  if old.id <> auth.uid() and old.role <> 'user' and not public.is_master_admin() then
    raise exception 'Nu puteți modifica un administrator';
  end if;
  return new;
end $$;

-- =============================================================================
-- Row Level Security changes
-- =============================================================================

-- groups / proposals / responses: only visible championships
drop policy "read_authenticated" on public.groups;
create policy "read_visible" on public.groups for select to authenticated
  using (public.can_view_group(id));

drop policy "read_authenticated" on public.hosting_proposals;
create policy "read_visible" on public.hosting_proposals for select to authenticated
  using (public.can_view_group(group_id));

drop policy "read_authenticated" on public.proposal_responses;
create policy "read_visible" on public.proposal_responses for select to authenticated
  using (public.can_view_group((select group_id from public.hosting_proposals where id = proposal_id)));

-- proposals & responses change only through workflow functions
drop policy "admin_insert" on public.hosting_proposals;
drop policy "admin_update" on public.hosting_proposals;
drop policy "admin_delete" on public.hosting_proposals;
drop policy "admin_insert" on public.proposal_responses;
drop policy "admin_update" on public.proposal_responses;
drop policy "admin_delete" on public.proposal_responses;

-- games
drop policy "read_authenticated" on public.games;
drop policy "admin_insert" on public.games;
drop policy "admin_update" on public.games;
drop policy "admin_delete" on public.games;
drop policy "host_insert_games" on public.games;
drop policy "host_update_games" on public.games;
drop policy "host_delete_games" on public.games;

create policy "read_visible" on public.games for select to authenticated
  using (public.can_view_game_row(competition, group_id, region, home_team_id, away_team_id));
create policy "manage_insert" on public.games for insert to authenticated
  with check (public.can_manage_game_row(competition, group_id, region, home_team_id, away_team_id));
create policy "manage_update" on public.games for update to authenticated
  using (public.can_manage_game_row(competition, group_id, region, home_team_id, away_team_id))
  with check (public.can_manage_game_row(competition, group_id, region, home_team_id, away_team_id));
create policy "manage_delete" on public.games for delete to authenticated
  using (public.can_manage_game_row(competition, group_id, region, home_team_id, away_team_id));

-- profiles: contacts only where allowed; deletes go through the auth admin API
drop policy "read_authenticated" on public.profiles;
drop policy "admin_delete" on public.profiles;
create policy "read_allowed" on public.profiles for select to authenticated
  using (public.can_view_profile(id));

-- club admins assign coaches to their club's teams
create policy "club_admin_insert_coach" on public.team_coaches for insert to authenticated
  with check (exists (select 1 from public.teams t join public.club_managers cm on cm.club_id = t.club_id
                       where t.id = team_id and cm.user_id = auth.uid()));
create policy "club_admin_delete_coach" on public.team_coaches for delete to authenticated
  using (exists (select 1 from public.teams t join public.club_managers cm on cm.club_id = t.club_id
                  where t.id = team_id and cm.user_id = auth.uid()));

-- external clubs: everyone reads (autocomplete), anyone logged in adds
alter table public.external_clubs enable row level security;
create policy "read_authenticated" on public.external_clubs for select to authenticated using (true);
create policy "insert_authenticated" on public.external_clubs for insert to authenticated
  with check (created_by = auth.uid());
create policy "admin_update" on public.external_clubs for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete" on public.external_clubs for delete to authenticated using (public.is_admin());

-- nominations: visible with the game; admins of the game's region nominate
alter table public.game_officials enable row level security;
create policy "read_visible" on public.game_officials for select to authenticated
  using (user_id = auth.uid() or public.can_view_game(game_id));
create policy "admin_insert" on public.game_officials for insert to authenticated
  with check (public.can_admin_region(public.game_region(game_id)));
create policy "admin_update" on public.game_officials for update to authenticated
  using (public.can_admin_region(public.game_region(game_id)))
  with check (public.can_admin_region(public.game_region(game_id)));
create policy "admin_delete" on public.game_officials for delete to authenticated
  using (public.can_admin_region(public.game_region(game_id)));

-- unavailability: own rows; admins read
alter table public.official_unavailability enable row level security;
create policy "own_or_admin_read" on public.official_unavailability for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "own_insert" on public.official_unavailability for insert to authenticated
  with check (user_id = auth.uid() and public.is_official());
create policy "own_update" on public.official_unavailability for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_delete" on public.official_unavailability for delete to authenticated
  using (user_id = auth.uid());

revoke execute on function public.respond_to_nomination(uuid, public.nomination_status, text) from public, anon;
