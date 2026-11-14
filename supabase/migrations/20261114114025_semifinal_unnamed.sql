-- Semifinals whose name was cleared (or games added by hand without a name):
-- when a group has games waiting for "Câștigătoare / Învinsă SFx" but no game named
-- "Semifinala 1/2", its first two games with both teams set (by start time) are SF1 and SF2.
-- (Which one is SF1 only decides home / away in the finals.)
create or replace function public.semifinal_of(p_game_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_group uuid;
  v_label text;
  v_rank  int;
begin
  select group_id, label into v_group, v_label from public.games where id = p_game_id;
  if v_group is null then return null; end if;
  if v_label ~* '^semifinala\s*1(\D|$)' then return 'SF1'; end if;
  if v_label ~* '^semifinala\s*2(\D|$)' then return 'SF2'; end if;

  -- only for groups waiting on semifinal results, and without named semifinals
  if not exists (select 1 from public.games where group_id = v_group
                  and (home_label ~* '\sSF[12]$' or away_label ~* '\sSF[12]$')) then
    return null;
  end if;
  if exists (select 1 from public.games where group_id = v_group and label ~* '^semifinala\s*[12](\D|$)') then
    return null;
  end if;

  select n into v_rank from (
    select id, row_number() over (order by starts_at, id) as n
      from public.games
     where group_id = v_group
       and home_team_id is not null and away_team_id is not null
       and home_label is null and away_label is null
  ) x where x.id = p_game_id;
  return case v_rank when 1 then 'SF1' when 2 then 'SF2' end;
end $$;

create or replace function public.advance_semifinal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sf      text;
  v_winner  uuid;
  v_loser   uuid;
begin
  if new.group_id is null then return new; end if;
  -- a final being filled in does not make it a semifinal
  if new.home_label is not null or new.away_label is not null then return new; end if;
  v_sf := public.semifinal_of(new.id);
  if v_sf is null then return new; end if;

  if new.status = 'played' and new.home_score is not null and new.away_score is not null
     and new.home_score <> new.away_score then
    if new.home_score > new.away_score then
      v_winner := new.home_team_id; v_loser := new.away_team_id;
    else
      v_winner := new.away_team_id; v_loser := new.home_team_id;
    end if;
  elsif new.status = 'forfeit_home' then
    v_winner := new.away_team_id; v_loser := new.home_team_id;
  elsif new.status = 'forfeit_away' then
    v_winner := new.home_team_id; v_loser := new.away_team_id;
  end if;
  -- no result (yet / any more): the placeholders stay without a team

  update public.games g
     set home_team_id = case
           when g.home_label ~* ('^c\S*tig\S*\s+' || v_sf || '$') then v_winner
           when g.home_label ~* ('^\S?nvins\S*\s+' || v_sf || '$') then v_loser
           else g.home_team_id end,
         away_team_id = case
           when g.away_label ~* ('^c\S*tig\S*\s+' || v_sf || '$') then v_winner
           when g.away_label ~* ('^\S?nvins\S*\s+' || v_sf || '$') then v_loser
           else g.away_team_id end
   where g.group_id = new.group_id
     and g.id <> new.id
     and g.status = 'scheduled'
     and (g.home_label ~* ('\s' || v_sf || '$') or g.away_label ~* ('\s' || v_sf || '$'));
  return new;
end $$;

-- semifinals already played (named or not) in groups still waiting
update public.games set status = status
 where status <> 'scheduled'
   and home_label is null and away_label is null
   and group_id in (select group_id from public.games
                     where group_id is not null and (home_label ~* '\sSF[12]$' or away_label ~* '\sSF[12]$'));
