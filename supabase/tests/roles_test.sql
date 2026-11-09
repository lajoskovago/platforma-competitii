-- Roles, visibility, national games, nominations. Transaction, rolled back.
-- Expects a freshly seeded DB (npm run db:reset).
begin;
-- normal flow: switch off the temporary auto-confirmation
update public.app_settings set auto_confirm_until = null;

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
$$;
create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  raise exception 'FAIL (should have been refused): %', label;
end $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
end $$;

insert into auth.users (id, email, instance_id, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','master@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a5','reg5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a6','reg6@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c1','coach@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c2','clubadm@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f5','ref5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f6','to6@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
update profiles set role='master_admin' where email='master@t.ro';
update profiles set role='regional_admin', region='SR5' where email='reg5@t.ro';
update profiles set role='regional_admin', region='SR6' where email='reg6@t.ro';
update profiles set is_referee=true, region='SR5' where email='ref5@t.ro';
update profiles set is_table_official=true, region='SR6' where email='to6@t.ro';

-- coach: LPS Satu Mare U10M ; club admin: U-BT (SR6)
insert into team_coaches select t.id, '00000000-0000-0000-0000-0000000000c1' from teams t join categories c on c.id=t.category_id
  where c.scope='regional' and c.code='U10M' and t.name='LPS Satu Mare';
insert into club_managers select id, '00000000-0000-0000-0000-0000000000c2' from clubs where name='U-BT';
-- national team for U-BT in L1M
insert into teams (club_id, category_id, name)
  select cl.id, c.id, 'U-BT L1' from clubs cl, categories c where cl.name='U-BT' and c.scope='national' and c.code='L1M';

create temp table ids (k text primary key, v uuid);
insert into ids select 'g_u10m_1', g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id
  where c.scope='regional' and c.code='U10M' and g.name='Grupa 1 (SR5)';
insert into ids select 'g_u12m_1', g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id
  where c.scope='regional' and c.code='U12M' and g.name='Grupa 1 (SR6)';
insert into ids select 'g_u10m_sr6', g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id
  where c.scope='regional' and c.code='U10M' and g.name='Grupa 1 (SR6)';
insert into ids select 't_ubt_l1', id from teams where name='U-BT L1';
insert into ids select 'cat_l1m', id from categories where scope='national' and code='L1M';
insert into ids select 't_lps', id from teams t where t.name='LPS Satu Mare' and t.category_id=(select id from categories where scope='regional' and code='U10M');
insert into ids select 't_ubt_u10', id from teams t where t.name='U-BT Gri' and t.category_id=(select id from categories where scope='regional' and code='U10M');
grant all on ids to authenticated;

set local role authenticated;

-- ---------------- visibility of regional groups
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');  -- coach U10M
select pg_temp.check((select count(*) from groups where id=(select v from ids where k='g_u10m_1')) = 1, 'coach sees own group');
select pg_temp.check((select count(*) from groups where id=(select v from ids where k='g_u10m_sr6')) = 1, 'coach sees other group of same championship');
select pg_temp.check((select count(*) from groups where id=(select v from ids where k='g_u12m_1')) = 0, 'coach does NOT see other championship');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');  -- referee SR5
select pg_temp.check((select count(*) from groups) = (select count(*) from group_overview), 'referee sees all regional groups');
select pg_temp.check((select count(*) from groups) > 20, 'referee sees many groups');

-- ---------------- regional admin intervention limited to own region
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');  -- reg SR5
insert into gyms (name, city, created_by) values ('Sala Test','Cluj', auth.uid());
-- SR5 admin proposes on behalf of a SR6 team in SR6 group -> refused (club region SR6)
select pg_temp.expect_fail(format($q$select create_proposal(%L,%L,(select id from gyms where name='Sala Test'),'2026-12-01',null,null,true)$q$,
  (select v from ids where k='g_u10m_sr6'), (select v from ids where k='t_ubt_u10')), 'SR5 admin acting for SR6 team');
-- SR6 admin can
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
insert into ids select 'p6', create_proposal((select v from ids where k='g_u10m_sr6'),(select v from ids where k='t_ubt_u10'),(select id from gyms where name='Sala Test'),'2026-12-01',null,null,true);
-- SR5 admin cannot confirm SR6 group, SR6 admin can
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select pg_temp.expect_fail(format('select admin_confirm_proposal(%L)', (select v from ids where k='p6')), 'SR5 confirms SR6 group');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select admin_confirm_proposal((select v from ids where k='p6'));
select pg_temp.check((select status from group_overview where group_id=(select v from ids where k='g_u10m_sr6'))='confirmed', 'SR6 admin confirmed');

-- ---------------- national games
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');  -- U-BT club admin
insert into games (competition, category_id, home_team_id, away_external, starts_at)
  values ('national', (select v from ids where k='cat_l1m'), (select v from ids where k='t_ubt_l1'), 'CSM București', '2026-12-05 18:00+02');
insert into ids select 'ng', id from games where competition='national' and away_external='CSM București';
select pg_temp.check((select region from games where id=(select v from ids where k='ng'))='SR6', 'national region defaults from club');
-- club admin cannot create a national game for a team that is not theirs
select pg_temp.expect_fail($q$insert into games (competition, category_id, home_external, away_external, starts_at, region)
  values ('national', (select v from ids where k='cat_l1m'), 'A', 'B', now(), 'SR5')$q$, 'club admin national game without own team');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');  -- coach LPS (not involved)
select pg_temp.check((select count(*) from games where id=(select v from ids where k='ng'))=0, 'coach does not see other national game');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');  -- referee SR5
select pg_temp.check((select count(*) from games where id=(select v from ids where k='ng'))=0, 'SR5 referee does not see SR6 national game');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');  -- TO SR6
select pg_temp.check((select count(*) from games where id=(select v from ids where k='ng'))=1, 'SR6 official sees SR6 national game');

-- ---------------- nominations
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');  -- SR5 admin cannot nominate on SR6 game
select pg_temp.expect_fail(format($q$insert into game_officials (game_id, position, user_id) values (%L,'scorer','00000000-0000-0000-0000-0000000000f6')$q$,
  (select v from ids where k='ng')), 'SR5 admin nominates on SR6 game');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
-- table official cannot be referee
select pg_temp.expect_fail(format($q$insert into game_officials (game_id, position, user_id) values (%L,'referee_1','00000000-0000-0000-0000-0000000000f6')$q$,
  (select v from ids where k='ng')), 'TO as referee');
insert into game_officials (game_id, position, user_id) values ((select v from ids where k='ng'),'scorer','00000000-0000-0000-0000-0000000000f6');
insert into game_officials (game_id, position, user_id) values ((select v from ids where k='ng'),'referee_1','00000000-0000-0000-0000-0000000000f5');
-- same person twice in one game -> refused
select pg_temp.expect_fail(format($q$insert into game_officials (game_id, position, user_id) values (%L,'timekeeper','00000000-0000-0000-0000-0000000000f6')$q$,
  (select v from ids where k='ng')), 'same person two positions');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f6');
select pg_temp.expect_fail(format($q$select respond_to_nomination((select id from game_officials where game_id=%L and position='scorer'),'rejected','')$q$,
  (select v from ids where k='ng')), 'reject without reason');
select respond_to_nomination((select id from game_officials where game_id=(select v from ids where k='ng') and position='scorer'),'rejected','Sunt bolnav');
-- cannot answer someone else's nomination
select pg_temp.expect_fail(format($q$select respond_to_nomination((select id from game_officials where game_id=%L and position='referee_1'),'accepted')$q$,
  (select v from ids where k='ng')), 'answer others nomination');
-- cannot change nominations directly
update game_officials set status='accepted' where position='referee_1';
select pg_temp.check((select status from game_officials where position='referee_1' and game_id=(select v from ids where k='ng'))='pending', 'official cannot update directly');

-- coach of involved team sees the officials' names, not contacts
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from game_officials where game_id=(select v from ids where k='ng'))=2, 'club admin sees nominations');
select pg_temp.check((select count(*) from profile_names where id='00000000-0000-0000-0000-0000000000f5')=1, 'names visible');
select pg_temp.check((select count(*) from profiles where id='00000000-0000-0000-0000-0000000000f5')=0, 'referee contact hidden');

-- ---------------- unavailability
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');
insert into official_unavailability (start_date, end_date, start_time, end_time, note) values ('2026-12-05','2026-12-05','14:00','20:00','Examen');
select pg_temp.expect_fail($q$insert into official_unavailability (start_date, end_date, start_time) values ('2026-12-05','2026-12-07','10:00')$q$, 'hours on multi-day');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from official_unavailability)=0, 'coach cannot see unavailability');
select pg_temp.expect_fail($q$insert into official_unavailability (start_date, end_date) values ('2026-12-05','2026-12-05')$q$, 'coach adds unavailability');

-- ---------------- profile protection
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select pg_temp.expect_fail($q$update profiles set role='master_admin' where id=auth.uid()$q$, 'regional promotes self');
select pg_temp.expect_fail($q$update profiles set full_name='x' where email='master@t.ro'$q$, 'regional edits master');
update profiles set is_table_official=true where email='ref5@t.ro';  -- allowed: admin manages officials
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');
select pg_temp.expect_fail($q$update profiles set region='SR6' where id=auth.uid()$q$, 'official changes own region');

select 'ALL ROLE TESTS PASSED' as result;
rollback;
