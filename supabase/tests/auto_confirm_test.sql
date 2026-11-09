-- Temporary auto-confirmation of hosting proposals. Transaction, rolled back.
-- Expects a freshly seeded DB (npm run db:reset).
begin;
update public.app_settings set auto_confirm_until = now() + interval '1 day';

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
$$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL: %', label; end if;
end $$;

insert into auth.users (id, email, instance_id, aud, role) values
 ('00000000-0000-0000-0000-0000000000b1','c1@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b2','m2@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b3','m3@t.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');

create temp table ids (k text primary key, v uuid);
insert into ids select 'g1', g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id
  where c.scope='regional' and c.code='U10M' and g.name='Grupa 1 (SR5)';
insert into ids select 'g2', g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id
  where c.scope='regional' and c.code='U10M' and g.name='Grupa 2 (SR5)';
insert into ids select 't_lps', t.id from teams t join categories c on c.id=t.category_id where c.scope='regional' and c.code='U10M' and t.name='LPS Satu Mare';
insert into ids select 't_valbon', t.id from teams t join categories c on c.id=t.category_id where c.scope='regional' and c.code='U10M' and t.name='Valbon Arad';
insert into ids select 't_star18', id from teams where name='ACS Baschet Star 2018 Dacia';
insert into team_coaches select (select v from ids where k='t_lps'), '00000000-0000-0000-0000-0000000000b1';
insert into team_coaches select (select v from ids where k='t_valbon'), '00000000-0000-0000-0000-0000000000b2';
insert into club_managers select id, '00000000-0000-0000-0000-0000000000b3' from clubs where name='ACS Baschet Star';
insert into gyms (name, city) values ('Sala Auto', 'Oradea');
grant all on ids to authenticated;

set local role authenticated;

-- 1. single proposal -> confirmed immediately, no acceptances needed
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into ids select 'p1', create_proposal((select v from ids where k='g1'), (select v from ids where k='t_lps'),
  (select id from gyms where name='Sala Auto'), '2026-11-15', null, null, true);
select pg_temp.check((select status from hosting_proposals where id=(select v from ids where k='p1'))='confirmed', 'auto confirmed');
select pg_temp.check((select auto_confirmed from hosting_proposals where id=(select v from ids where k='p1')), 'flagged auto');
select pg_temp.check((select status from group_overview where group_id=(select v from ids where k='g1'))='confirmed', 'group confirmed');
-- host can add games right away
insert into games (group_id, label, home_team_id, away_team_id, starts_at)
  select (select v from ids where k='g1'), 'Meci 1', (select v from ids where k='t_lps'), t.id, '2026-11-15 10:00+02'
    from teams t join categories c on c.id=t.category_id where c.scope='regional' and c.code='U10M' and t.name='CSS Sighet';

-- 2. editing the date keeps it confirmed during the auto period
select update_proposal((select v from ids where k='p1'), (select id from gyms where name='Sala Auto'), '2026-11-14');
select pg_temp.check((select status from hosting_proposals where id=(select v from ids where k='p1'))='confirmed', 'still confirmed after edit');

-- 3. two teams racing in the same group: the first one wins, the second is refused
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into ids select 'p2', create_proposal((select v from ids where k='g2'), (select v from ids where k='t_valbon'),
  (select id from gyms where name='Sala Auto'), '2026-11-15', null, null, true);
select pg_temp.check((select status from hosting_proposals where id=(select v from ids where k='p2'))='confirmed', 'first in group 2 confirmed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
do $$ begin
  perform create_proposal((select v from ids where k='g2'), (select v from ids where k='t_star18'),
    (select id from gyms where name='Sala Auto'), '2026-11-15', null, null, true);
  raise exception 'FAIL second proposal accepted';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- 4. after the period ends, the normal flow applies again
reset role;
update public.app_settings set auto_confirm_until = now() - interval '1 minute';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select update_proposal((select v from ids where k='p1'), (select id from gyms where name='Sala Auto'), '2026-11-21');
select pg_temp.check((select status from hosting_proposals where id=(select v from ids where k='p1'))='pending', 'normal flow after period');

select 'ALL AUTO-CONFIRM TESTS PASSED' as result;
rollback;
