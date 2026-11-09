-- Club admins manage their own NATIONAL teams only. Transaction, rolled back.
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
 ('00000000-0000-0000-0000-0000000000d1','ubt.admin@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
insert into club_managers select id, '00000000-0000-0000-0000-0000000000d1' from clubs where name='U-BT';

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');

-- own club, national category: allowed
insert into teams (club_id, category_id, name)
  select (select id from clubs where name='U-BT'), (select id from categories where scope='national' and code='L1M'), 'U-BT L1 Test';
select pg_temp.check((select count(*) from teams where name='U-BT L1 Test') = 1, 'club admin creates national team');
update teams set name='U-BT L1 Test 2' where name='U-BT L1 Test';
select pg_temp.check((select count(*) from teams where name='U-BT L1 Test 2') = 1, 'club admin renames national team');

-- own club, regional category: refused
select pg_temp.expect_fail($q$insert into teams (club_id, category_id, name)
  select (select id from clubs where name='U-BT'), (select id from categories where scope='regional' and code='U10M'), 'U-BT Regional X'$q$,
  'club admin creates regional team');
-- other club: refused
select pg_temp.expect_fail($q$insert into teams (club_id, category_id, name)
  select (select id from clubs where name='Valbon Arad'), (select id from categories where scope='national' and code='L1M'), 'Valbon L1 X'$q$,
  'club admin creates team for another club');
-- cannot rename a regional team of own club (0 rows updated)
update teams set name='hacked' where name='U-BT Gri';
select pg_temp.check((select count(*) from teams where name='hacked') = 0, 'regional team untouched');

delete from teams where name='U-BT L1 Test 2';
select pg_temp.check((select count(*) from teams where name='U-BT L1 Test 2') = 0, 'club admin deletes national team');

select 'ALL CLUB TEAM TESTS PASSED' as result;
rollback;
