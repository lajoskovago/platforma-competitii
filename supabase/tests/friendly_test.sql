-- Friendly games: visibility & management. Transaction, rolled back.
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
 ('00000000-0000-0000-0000-0000000000a5','reg5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a6','reg6@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c1','coach.valbon@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c2','coach.other@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f5','ref5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f6','ref6@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
update profiles set role='regional_admin', region='SR5' where email='reg5@t.ro';
update profiles set role='regional_admin', region='SR6' where email='reg6@t.ro';
update profiles set is_referee=true, region='SR5' where email='ref5@t.ro';
update profiles set is_referee=true, region='SR6' where email='ref6@t.ro';

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids select 'cat', id from categories where scope='regional' and code='U14M';
insert into ids select 't_valbon', t.id from teams t where t.name='Valbon Arad' and t.category_id=(select v from ids where k='cat');
insert into ids select 't_ubt', t.id from teams t where t.name='U-BT Gri' and t.category_id=(select v from ids where k='cat');
insert into team_coaches values ((select v from ids where k='t_valbon'), '00000000-0000-0000-0000-0000000000c1');
insert into team_coaches values ((select v from ids where k='t_ubt'), '00000000-0000-0000-0000-0000000000c2');

set local role authenticated;

-- coach of Valbon adds an SR5 friendly against an outside team
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into games (competition, category_id, region, home_team_id, away_external, starts_at)
  values ('friendly', (select v from ids where k='cat'), 'SR5', (select v from ids where k='t_valbon'), 'CSM Test', '2026-11-20 18:00+02');
reset role;
insert into ids select 'fg', id from games where competition='friendly' and away_external='CSM Test';
set local role authenticated;

-- a coach cannot add a friendly without his own team
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_fail($q$insert into games (competition, category_id, region, home_external, away_external, starts_at)
  values ('friendly', (select v from ids where k='cat'), 'SR5', 'A', 'B', now())$q$, 'coach adds friendly without own team');
-- friendly needs a region
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select pg_temp.expect_fail($q$insert into games (competition, category_id, home_external, away_external, starts_at)
  values ('friendly', (select v from ids where k='cat'), 'A', 'B', now())$q$, 'friendly without region');

-- visibility
create or replace function pg_temp.sees(uid text) returns boolean language plpgsql as $$
begin
  perform pg_temp.as_user(uid);
  return exists (select 1 from games where id = (select v from ids where k='fg'));
end $$;
select pg_temp.check(pg_temp.sees('00000000-0000-0000-0000-0000000000c1'), 'playing team sees it');
select pg_temp.check(not pg_temp.sees('00000000-0000-0000-0000-0000000000c2'), 'other coach does not');
select pg_temp.check(pg_temp.sees('00000000-0000-0000-0000-0000000000a5'), 'SR5 admin sees it');
select pg_temp.check(not pg_temp.sees('00000000-0000-0000-0000-0000000000a6'), 'SR6 admin does not');
select pg_temp.check(pg_temp.sees('00000000-0000-0000-0000-0000000000f5'), 'SR5 referee sees it');
select pg_temp.check(not pg_temp.sees('00000000-0000-0000-0000-0000000000f6'), 'SR6 referee does not');

-- nominations: SR5 admin yes, SR6 admin no
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select pg_temp.expect_fail(format($q$insert into game_officials (game_id, position, user_id) values (%L,'referee_1','00000000-0000-0000-0000-0000000000f6')$q$,
  (select v from ids where k='fg')), 'SR6 admin nominates on SR5 friendly');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
insert into game_officials (game_id, position, user_id) values ((select v from ids where k='fg'),'referee_1','00000000-0000-0000-0000-0000000000f5');

select 'ALL FRIENDLY TESTS PASSED' as result;
rollback;
