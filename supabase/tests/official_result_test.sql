-- Officials entering the final result of their game. Transaction, rolled back.
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
 ('00000000-0000-0000-0000-0000000000f1','ref1@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f2','ref2@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000f3','ref3@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
update profiles set is_referee = true, region = 'SR5' where email like 'ref_@t.ro';

insert into games (id, competition, category_id, home_external, away_external, starts_at, region)
  select '00000000-0000-0000-0000-0000000000c1', 'national', id, 'A', 'B', now() - interval '2 hours', 'SR5'
    from categories where scope = 'national' and code = 'L1M';
insert into games (id, competition, category_id, home_external, away_external, starts_at, region)
  select '00000000-0000-0000-0000-0000000000c2', 'national', id, 'A', 'B', now() + interval '1 day', 'SR5'
    from categories where scope = 'national' and code = 'L1M';
insert into game_officials (game_id, position, user_id) values
 ('00000000-0000-0000-0000-0000000000c1', 'referee_1', '00000000-0000-0000-0000-0000000000f1'),
 ('00000000-0000-0000-0000-0000000000c1', 'referee_2', '00000000-0000-0000-0000-0000000000f2'),
 ('00000000-0000-0000-0000-0000000000c2', 'referee_1', '00000000-0000-0000-0000-0000000000f1');
update game_officials set status = 'accepted' where user_id = '00000000-0000-0000-0000-0000000000f1';

set local role authenticated;

-- confirmed official, game started: result saved, author recorded
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select official_set_result('00000000-0000-0000-0000-0000000000c1', 'played', 71, 64);
select pg_temp.check(
  (select status = 'played' and home_score = 71 and away_score = 64
          and result_by = '00000000-0000-0000-0000-0000000000f1' and result_at is not null
     from games where id = '00000000-0000-0000-0000-0000000000c1'),
  'official saves the result');
-- correction, forfeit clears the score
select official_set_result('00000000-0000-0000-0000-0000000000c1', 'forfeit_away', null, null);
select pg_temp.check(
  (select status = 'forfeit_away' and home_score is null from games where id = '00000000-0000-0000-0000-0000000000c1'),
  'official corrects to forfeit');
select pg_temp.expect_fail($q$select official_set_result('00000000-0000-0000-0000-0000000000c1', 'played', 50, 50)$q$, 'draw');
select pg_temp.expect_fail($q$select official_set_result('00000000-0000-0000-0000-0000000000c1', 'played', 50, null)$q$, 'missing score');
-- game not started yet
select pg_temp.expect_fail($q$select official_set_result('00000000-0000-0000-0000-0000000000c2', 'played', 80, 70)$q$, 'before start');
-- still no general update right on the game
update games set starts_at = now() where id = '00000000-0000-0000-0000-0000000000c1';
reset role;
select pg_temp.check(
  (select starts_at < now() - interval '1 hour' from games where id = '00000000-0000-0000-0000-0000000000c1'),
  'official cannot change other game fields');
set local role authenticated;

-- nominated but not confirmed
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.expect_fail($q$select official_set_result('00000000-0000-0000-0000-0000000000c1', 'played', 80, 70)$q$, 'pending nominee');
-- not nominated
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect_fail($q$select official_set_result('00000000-0000-0000-0000-0000000000c1', 'played', 80, 70)$q$, 'not nominated');

rollback;
select 'official_result_test OK';
