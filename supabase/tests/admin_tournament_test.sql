-- Admin changes date / gym of a confirmed tournament. Transaction, rolled back.
begin;
update public.app_settings set auto_confirm_until = null;
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
 ('00000000-0000-0000-0000-0000000000a1','master@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a6','reg6@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000c1','coach@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
update profiles set role='master_admin' where email='master@t.ro';
update profiles set role='regional_admin', region='SR6' where email='reg6@t.ro';

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into ids select 'g', g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id
  where c.scope='regional' and c.code='U10M' and g.name='Grupa 1 (SR5)';
insert into ids select 't1', t.id from teams t join categories c on c.id=t.category_id where c.scope='regional' and c.code='U10M' and t.name='LPS Satu Mare';
insert into ids select 't2', t.id from teams t join categories c on c.id=t.category_id where c.scope='regional' and c.code='U10M' and t.name='CSS Sighet';
insert into team_coaches values ((select v from ids where k='t1'), '00000000-0000-0000-0000-0000000000c1');
insert into gyms (name, city) values ('Sala Veche','Satu Mare'), ('Sala Nouă','Satu Mare'), ('Sala Alta','Satu Mare');
insert into ids select 'old', id from gyms where name='Sala Veche';
insert into ids select 'new', id from gyms where name='Sala Nouă';
insert into ids select 'other', id from gyms where name='Sala Alta';

-- master assigns organiser for 22 Mar 2027 (before DST change on 28 Mar), games at 10:00 and 12:00
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select admin_assign_organizer((select v from ids where k='g'), (select v from ids where k='t1'), (select v from ids where k='old'), '2027-03-21');
insert into games (group_id, label, home_team_id, away_team_id, starts_at, gym_id) values
  ((select v from ids where k='g'), 'Meci 1', (select v from ids where k='t1'), (select v from ids where k='t2'), '2027-03-21 10:00+02', (select v from ids where k='old')),
  ((select v from ids where k='g'), 'Meci 2', (select v from ids where k='t2'), (select v from ids where k='t1'), '2027-03-21 12:00+02', (select v from ids where k='other'));

-- coach and the SR6 admin may not change it
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_fail(format($q$select admin_update_tournament(%L,%L,'2027-03-28')$q$, (select v from ids where k='g'), (select v from ids where k='new')), 'coach changes tournament');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
select pg_temp.expect_fail(format($q$select admin_update_tournament(%L,%L,'2027-03-28')$q$, (select v from ids where k='g'), (select v from ids where k='new')), 'SR6 admin changes SR5 tournament');

-- master moves it one week later (across the DST change) to the new gym
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select admin_update_tournament((select v from ids where k='g'), (select v from ids where k='new'), '2027-03-28');
reset role;
select pg_temp.check((select status from group_overview where group_id=(select v from ids where k='g'))='scheduled', 'still confirmed with program');
select pg_temp.check((select start_date from hosting_proposals hp join groups g on g.confirmed_proposal_id=hp.id where g.id=(select v from ids where k='g'))='2027-03-28', 'new date saved');
select pg_temp.check(
  (select to_char(starts_at at time zone 'Europe/Bucharest', 'YYYY-MM-DD HH24:MI') from games where label='Meci 1' and group_id=(select v from ids where k='g')) = '2027-03-28 10:00',
  'game moved, same local time across DST');
select pg_temp.check((select gym_id from games where label='Meci 1' and group_id=(select v from ids where k='g'))=(select v from ids where k='new'), 'game at old gym -> new gym');
select pg_temp.check((select gym_id from games where label='Meci 2' and group_id=(select v from ids where k='g'))=(select v from ids where k='other'), 'game at another gym keeps it');

-- without moving games
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select admin_update_tournament((select v from ids where k='g'), (select v from ids where k='new'), '2027-04-04', null, null, false);
reset role;
select pg_temp.check(
  (select to_char(starts_at at time zone 'Europe/Bucharest', 'YYYY-MM-DD') from games where label='Meci 1' and group_id=(select v from ids where k='g')) = '2027-03-28',
  'games not moved when unchecked');

select 'ALL ADMIN TOURNAMENT TESTS PASSED' as result;
rollback;
