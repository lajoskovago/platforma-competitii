-- =============================================================================
-- Friendly games: standalone games like the national ones (category, region,
-- our teams or free-text opponents), not part of any championship.
-- Visibility / management reuse the non-regional rules:
--   master admin; admins, delegates and officials of the game's region;
--   coaches / club admins of the two teams.
-- =============================================================================

alter table public.games drop constraint games_competition_shape;
alter table public.games add constraint games_competition_shape
  check ((competition = 'regional' and group_id is not null)
      or (competition in ('national', 'friendly')
          and group_id is null and category_id is not null and region is not null));

-- Region of a standalone game is its own region; regional games take the group's.
create or replace function public.game_region_of(p_competition public.game_competition, p_group_id uuid, p_region public.region)
returns public.region language sql stable security definer set search_path = '' as $$
  select case when p_competition = 'regional' then public.group_region(p_group_id) else p_region end;
$$;

create index if not exists games_region_idx on public.games (region) where competition <> 'regional';
