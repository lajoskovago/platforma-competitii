-- Nomination delegates. Transaction, rolled back. Expects a freshly seeded DB.
begin;
create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
$$;
create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then return; end;
  raise exception 'FAIL (should have been refused): %', label;
end $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if; end $$;

insert into auth.users (id, email, instance_id, aud, role) values
 ('00000000-0000-0000-0000-0000000000e1','master@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000e5','reg5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000d5','delegate5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f5','ref5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f6','ref6@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
update profiles set role='master_admin' where email='master@t.ro';
update profiles set role='regional_admin', region='SR5' where email='reg5@t.ro';
update profiles set is_referee=true, region='SR5' where email in ('delegate5@t.ro','ref5@t.ro');
update profiles set is_referee=true, region='SR6' where email='ref6@t.ro';

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into teams (club_id, category_id, name)
  select (select id from clubs where name='Valbon Arad'), (select id from categories where scope='national' and code='U16M'), 'Valbon D';
insert into teams (club_id, category_id, name)
  select (select id from clubs where name='U-BT'), (select id from categories where scope='national' and code='U16M'), 'U-BT D';
insert into games (competition, category_id, home_team_id, away_external, starts_at)
  select 'national', (select id from categories where scope='national' and code='U16M'), (select id from teams where name='Valbon D'), 'X', '2026-12-05 10:00+02';
insert into games (competition, category_id, home_team_id, away_external, starts_at)
  select 'national', (select id from categories where scope='national' and code='U16M'), (select id from teams where name='U-BT D'), 'Y', '2026-12-05 10:00+02';
insert into ids select 'g5', id from games where home_team_id=(select id from teams where name='Valbon D');
insert into ids select 'g6', id from games where home_team_id=(select id from teams where name='U-BT D');
insert into official_unavailability (user_id, start_date, end_date) values
  ('00000000-0000-0000-0000-0000000000f5','2026-12-05','2026-12-05'),
  ('00000000-0000-0000-0000-0000000000f6','2026-12-05','2026-12-05');

set local role authenticated;

-- not a delegate yet: cannot nominate
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d5');
select pg_temp.expect_fail(format($q$insert into game_officials (game_id, position, user_id) values (%L,'referee_1','00000000-0000-0000-0000-0000000000f5')$q$,
  (select v from ids where k='g5')), 'non-delegate nominates');
-- cannot grant it to himself, regional admin cannot grant it either
select pg_temp.expect_fail($q$update profiles set can_nominate=true where id=auth.uid()$q$, 'self-grant');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e5');
select pg_temp.expect_fail($q$update profiles set can_nominate=true where email='delegate5@t.ro'$q$, 'regional admin grants');
-- master grants
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
update profiles set can_nominate=true where email='delegate5@t.ro';

-- delegate nominates in own region, not in the other one
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d5');
insert into game_officials (game_id, position, user_id) values ((select v from ids where k='g5'),'referee_1','00000000-0000-0000-0000-0000000000f5');
select pg_temp.check((select status from game_officials where game_id=(select v from ids where k='g5') and position='referee_1')='pending', 'delegate sees pending nomination');
select pg_temp.expect_fail(format($q$insert into game_officials (game_id, position, user_id) values (%L,'referee_1','00000000-0000-0000-0000-0000000000f6')$q$,
  (select v from ids where k='g6')), 'delegate nominates in other region');
-- unavailability: own region only
select pg_temp.check((select count(*) from official_unavailability where user_id='00000000-0000-0000-0000-0000000000f5')=1, 'delegate sees SR5 unavailability');
select pg_temp.check((select count(*) from official_unavailability where user_id='00000000-0000-0000-0000-0000000000f6')=0, 'delegate does not see SR6 unavailability');
-- master sees all unavailability; regional admin only own region
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select count(*) from official_unavailability where user_id in ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f6'))=2, 'master sees all unavailability');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e5');
select pg_temp.check((select count(*) from official_unavailability where user_id in ('00000000-0000-0000-0000-0000000000f5','00000000-0000-0000-0000-0000000000f6'))=1, 'regional admin sees own region');

select 'ALL DELEGATE TESTS PASSED' as result;
rollback;
