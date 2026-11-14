-- Groups of 4: when a semifinal gets its result, the winner and the loser are put
-- into the games waiting for them ("Câștigătoare SF1", "Învinsă SF2", ...).
-- The placeholder text is kept, so a corrected semifinal result updates the finals again;
-- a team chosen by hand (placeholder cleared) is never overwritten, nor is a final that
-- already has a result.
create or replace function public.advance_semifinal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_sf      text;
  v_winner  uuid;
  v_loser   uuid;
begin
  if new.group_id is null or new.label is null then return new; end if;
  v_sf := case
            when new.label ~* '^semifinala\s*1(\D|$)' then 'SF1'
            when new.label ~* '^semifinala\s*2(\D|$)' then 'SF2'
          end;
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

create trigger games_advance_semifinal
  after insert or update of status, home_score, away_score, home_team_id, away_team_id, label on public.games
  for each row execute function public.advance_semifinal();

-- semifinals already played before this change
update public.games set status = status
 where group_id is not null and label ~* '^semifinala\s*[12](\D|$)' and status <> 'scheduled';
