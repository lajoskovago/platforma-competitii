-- Referees and table officials who confirmed their nomination can enter the final
-- result of their game, once it has started. Only the result columns change:
-- officials get no general update right on games (time, gym, teams stay protected).
alter table public.games
  add column result_by uuid references public.profiles (id) on delete set null,
  add column result_at timestamptz;

create or replace function public.official_set_result(
  p_game_id uuid,
  p_status public.game_status,
  p_home_score int,
  p_away_score int
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_starts timestamptz;
begin
  if not exists (
    select 1 from public.game_officials
     where game_id = p_game_id and user_id = auth.uid() and status = 'accepted'
  ) then
    raise exception 'Doar arbitrii și oficialii care și-au confirmat nominalizarea pot introduce rezultatul';
  end if;

  select starts_at into v_starts from public.games where id = p_game_id;
  if v_starts > now() then
    raise exception 'Rezultatul se poate introduce după începerea meciului';
  end if;

  if p_status = 'played' then
    if p_home_score is null or p_away_score is null or p_home_score < 0 or p_away_score < 0
       or p_home_score > 300 or p_away_score > 300 then
      raise exception 'Completați scorul ambelor echipe';
    end if;
    if p_home_score = p_away_score then
      raise exception 'În baschet nu există egalitate';
    end if;
  end if;

  update public.games
     set status = p_status,
         home_score = case when p_status = 'played' then p_home_score end,
         away_score = case when p_status = 'played' then p_away_score end,
         result_by = auth.uid(),
         result_at = now()
   where id = p_game_id;
end $$;

revoke all on function public.official_set_result(uuid, public.game_status, int, int) from public, anon;
grant execute on function public.official_set_result(uuid, public.game_status, int, int) to authenticated, service_role;
