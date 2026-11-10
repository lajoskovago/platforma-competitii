-- Scoresheet of a game: manual (paper) or DSS (digital scoresheet software).
-- Decides which skill the Scorer position needs. Set by whoever nominates
-- officials for the game (admins of its region, nomination delegates).
alter table public.games add column scoresheet text check (scoresheet in ('manual', 'dss'));

create or replace function public.set_game_scoresheet(p_game_id uuid, p_scoresheet text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_scoresheet is not null and p_scoresheet not in ('manual', 'dss') then
    raise exception 'Tip de foaie de joc invalid';
  end if;
  if not public.can_nominate_region(public.game_region(p_game_id)) then
    raise exception 'Nu aveți drept de nominalizare pentru acest meci';
  end if;
  update public.games set scoresheet = p_scoresheet where id = p_game_id;
end $$;

grant execute on function public.set_game_scoresheet(uuid, text) to authenticated;
revoke execute on function public.set_game_scoresheet(uuid, text) from anon;
