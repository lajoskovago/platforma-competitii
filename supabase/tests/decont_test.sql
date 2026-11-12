-- Officials' payments: who can read / write. Transaction, rolled back.
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
 ('00000000-0000-0000-0000-0000000000a1','master@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a5','reg5@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f1','ref1@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f2','ref2@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
update profiles set role='master_admin' where email='master@t.ro';
update profiles set role='regional_admin', region='SR5' where email='reg5@t.ro';
update profiles set is_referee=true, region='SR5', city='Oradea' where email in ('ref1@t.ro','ref2@t.ro');
insert into official_payouts (user_id, amount, note) values
 ('00000000-0000-0000-0000-0000000000f1', 100, 'test1'), ('00000000-0000-0000-0000-0000000000f2', 50, 'test2');

set local role authenticated;
-- official: own payouts only, no rates / charges, cannot write
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) from official_payouts where note like 'test%') = 1, 'official sees only own payout');
select pg_temp.check((select count(*) from fee_rates) = 0 and (select count(*) from game_charges) = 0, 'official cannot read rates / charges');
select pg_temp.expect_fail($q$insert into official_payouts (user_id, amount) values ('00000000-0000-0000-0000-0000000000f1', 999)$q$, 'official adds payout');
select pg_temp.expect_fail($q$insert into fee_rates (category_id, position, amount) select id, 'referee_1', 1 from categories limit 1$q$, 'official sets rate');
-- regional admin (nominator): reads all, cannot write
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select pg_temp.check((select count(*) from official_payouts where note like 'test%') = 2, 'nominator sees all payouts');
select pg_temp.expect_fail($q$insert into official_payouts (user_id, amount) values ('00000000-0000-0000-0000-0000000000f1', 999)$q$, 'regional admin adds payout');
select pg_temp.expect_fail($q$insert into fee_rates (category_id, position, amount) select id, 'referee_1', 1 from categories limit 1$q$, 'regional admin sets rate');
-- only the master admin marks a nomination as self-invoiced (nominators may update other columns)
reset role;
insert into games (competition, category_id, home_external, away_external, starts_at, region)
  select 'national', id, 'A', 'B', now() - interval '1 day', 'SR5' from categories where scope='national' and code='L1M';
insert into game_officials (game_id, position, user_id)
  select id, 'referee_1', '00000000-0000-0000-0000-0000000000f1' from games where home_external='A' and away_external='B';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
select pg_temp.expect_fail($q$update game_officials set self_invoiced = true where user_id = '00000000-0000-0000-0000-0000000000f1'$q$, 'regional admin marks self-invoiced');
-- master writes
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into official_payouts (user_id, amount) values ('00000000-0000-0000-0000-0000000000f1', 10);
insert into fee_rates (category_id, position, amount) select id, 'referee_1', 99 from categories where scope='regional' and code='U18M';
update game_officials set self_invoiced = true where user_id = '00000000-0000-0000-0000-0000000000f1';
select 'ALL DECONT TESTS PASSED' as result;
rollback;
