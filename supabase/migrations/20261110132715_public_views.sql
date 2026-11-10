-- =============================================================================
-- Public (logged-out) schedule: read-only views exposing only safe columns.
--   * regional + national games (friendlies stay private)
--   * teams, date/time, gym – no scores, no officials, no contacts
-- The views run with their owner's rights (not security_invoker), so visitors
-- (role anon) get these columns without any access to the underlying tables.
-- =============================================================================

create view public.public_games as
select g.id,
       g.starts_at,
       g.competition,
       c.code  as category_code,
       c.name  as category_name,
       c.scope as category_scope,
       c.sort_order as category_sort,
       g.label,
       coalesce(h.name, g.home_external, g.home_label) as home_name,
       coalesce(a.name, g.away_external, g.away_label) as away_name,
       h.club_id as home_club_id,
       a.club_id as away_club_id,
       gy.name     as gym_name,
       gy.city     as gym_city,
       gy.address  as gym_address,
       gy.maps_url as gym_maps_url,
       g.group_id,
       gr.name as group_name,
       t.name  as tournament_name,
       (g.status <> 'scheduled') as is_done   -- "played", without revealing the result
  from public.games g
  join public.categories c on c.id = g.category_id
  left join public.teams h on h.id = g.home_team_id
  left join public.teams a on a.id = g.away_team_id
  left join public.gyms gy on gy.id = g.gym_id
  left join public.groups gr on gr.id = g.group_id
  left join public.tournaments t on t.id = gr.tournament_id
 where g.competition in ('regional', 'national');

-- Regional groups with their teams and (confirmed) organiser / date / gym
create view public.public_groups as
select gr.id as group_id,
       gr.name as group_name,
       gr.region,
       gr.notes,
       gr.sort_order,
       t.name as tournament_name,
       c.code as category_code,
       c.name as category_name,
       c.sort_order as category_sort,
       host.name as host_name,
       hp.start_date,
       hp.end_date,
       gy.name as gym_name,
       gy.city as gym_city,
       gy.address as gym_address,
       gy.maps_url as gym_maps_url
  from public.groups gr
  join public.tournaments t on t.id = gr.tournament_id
  join public.categories c on c.id = t.category_id
  left join public.hosting_proposals hp on hp.id = gr.confirmed_proposal_id
  left join public.teams host on host.id = hp.team_id
  left join public.gyms gy on gy.id = hp.gym_id;

create view public.public_group_teams as
select gt.group_id, tm.id as team_id, tm.name as team_name, cl.id as club_id, cl.name as club_name, cl.city as club_city
  from public.group_teams gt
  join public.teams tm on tm.id = gt.team_id
  join public.clubs cl on cl.id = tm.club_id;

create view public.public_clubs as
select id, name, city from public.clubs;

grant select on public.public_games, public.public_groups, public.public_group_teams, public.public_clubs
  to anon, authenticated;
