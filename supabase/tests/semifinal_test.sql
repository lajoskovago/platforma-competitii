-- Groups of 4: semifinal results fill the finals. Transaction, rolled back.
begin;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; end $$;

-- a group with 4 teams (A, B, C, D) and the generated 4-team schedule
insert into clubs (id, name) values ('00000000-0000-0000-0000-00000000c1b0', 'Club SF test');
insert into tournaments (id, name, number, category_id)
  select '00000000-0000-0000-0000-0000000000e1', 'SF test', 99, id from categories where scope = 'regional' limit 1;
insert into groups (id, tournament_id, name) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1', 'Grupa SF');
insert into teams (id, name, club_id, category_id)
  select v.id::uuid, v.name, '00000000-0000-0000-0000-00000000c1b0', t.category_id
    from tournaments t,
         (values ('00000000-0000-0000-0000-00000000000a', 'A'), ('00000000-0000-0000-0000-00000000000b', 'B'),
                 ('00000000-0000-0000-0000-00000000000c', 'C'), ('00000000-0000-0000-0000-00000000000d', 'D')) v(id, name)
   where t.id = '00000000-0000-0000-0000-0000000000e1';
insert into group_teams (group_id, team_id)
  select '00000000-0000-0000-0000-0000000000e2', id from teams where club_id = '00000000-0000-0000-0000-00000000c1b0';
insert into games (id, group_id, competition, label, starts_at, home_team_id, away_team_id, home_label, away_label) values
 ('00000000-0000-0000-0000-0000000005f1', '00000000-0000-0000-0000-0000000000e2', 'regional', 'Semifinala 1', now(),
  '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000d', null, null),
 ('00000000-0000-0000-0000-0000000005f2', '00000000-0000-0000-0000-0000000000e2', 'regional', 'Semifinala 2', now(),
  '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c', null, null),
 ('00000000-0000-0000-0000-0000000005f3', '00000000-0000-0000-0000-0000000000e2', 'regional', 'Finala mică (loc 3-4)', now(),
  null, null, 'Învinsă SF1', 'Învinsă SF2'),
 ('00000000-0000-0000-0000-0000000005f4', '00000000-0000-0000-0000-0000000000e2', 'regional', 'Finala mare (loc 1-2)', now(),
  null, null, 'Câștigătoare SF1', 'Câștigătoare SF2');

-- SF1: A beats D
update games set status = 'played', home_score = 70, away_score = 60 where id = '00000000-0000-0000-0000-0000000005f1';
select pg_temp.check((select home_team_id = '00000000-0000-0000-0000-00000000000a' and away_team_id is null
                        from games where id = '00000000-0000-0000-0000-0000000005f4'), 'winner SF1 in the final');
select pg_temp.check((select home_team_id = '00000000-0000-0000-0000-00000000000d'
                        from games where id = '00000000-0000-0000-0000-0000000005f3'), 'loser SF1 in the 3rd place game');
-- SF2: C does not show up -> B wins
update games set status = 'forfeit_away' where id = '00000000-0000-0000-0000-0000000005f2';
select pg_temp.check((select away_team_id = '00000000-0000-0000-0000-00000000000b'
                        from games where id = '00000000-0000-0000-0000-0000000005f4'), 'forfeit: winner SF2');
select pg_temp.check((select away_team_id = '00000000-0000-0000-0000-00000000000c'
                        from games where id = '00000000-0000-0000-0000-0000000005f3'), 'forfeit: loser SF2');
-- SF1 result corrected: D won
update games set home_score = 55 where id = '00000000-0000-0000-0000-0000000005f1';
select pg_temp.check((select home_team_id = '00000000-0000-0000-0000-00000000000d'
                        from games where id = '00000000-0000-0000-0000-0000000005f4'), 'corrected SF1 updates the final');
-- SF2 result removed: the finals wait again
update games set status = 'scheduled' where id = '00000000-0000-0000-0000-0000000005f2';
select pg_temp.check((select away_team_id is null from games where id = '00000000-0000-0000-0000-0000000005f4'),
                     'removed SF2 result empties the final side');
-- a final that has its own result is left alone
update games set status = 'forfeit_away' where id = '00000000-0000-0000-0000-0000000005f2';
update games set status = 'played', home_score = 80, away_score = 75 where id = '00000000-0000-0000-0000-0000000005f4';
update games set status = 'played', home_score = 90, away_score = 40 where id = '00000000-0000-0000-0000-0000000005f1';
select pg_temp.check((select home_team_id = '00000000-0000-0000-0000-00000000000d'
                        from games where id = '00000000-0000-0000-0000-0000000005f4'), 'played final not changed');
-- a team chosen by hand (placeholder cleared) is not overwritten
update games set home_label = null where id = '00000000-0000-0000-0000-0000000005f3';
update games set home_score = 10 where id = '00000000-0000-0000-0000-0000000005f1';
select pg_temp.check((select home_team_id = '00000000-0000-0000-0000-00000000000d'
                        from games where id = '00000000-0000-0000-0000-0000000005f3'), 'manual team kept');

rollback;
select 'semifinal_test OK';
