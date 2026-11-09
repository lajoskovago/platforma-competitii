-- Smoke test of the organising workflow. Runs inside a transaction and rolls back.
-- Expects a freshly seeded DB (npm run db:reset) – it uses U10M Grupa 1/2 (SR5).
-- docker exec -i supabase_db_competitii psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/workflow_test.sql
begin;
-- normal flow: switch off the temporary auto-confirmation
update public.app_settings set auto_confirm_until = null;
-- users: admin, coach of LPS Satu Mare U10M, coach of CSS Sighet U10M, manager of ACS Baschet Star
insert into auth.users (id, email, instance_id, aud, role) values
 ('00000000-0000-0000-0000-00000000000a','admin@test.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-000000000001','c1@test.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-000000000002','c2@test.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('00000000-0000-0000-0000-000000000003','m3@test.ro','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
update profiles set role='master_admin' where email='admin@test.ro';

create temp table ctx as
select (select g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id where c.code='U10M' and g.name='Grupa 1 (SR5)') as grp,
       (select id from teams where name='LPS Satu Mare' and category_id=(select id from categories where code='U10M')) as t1,
       (select id from teams where name='CSS Sighet' and category_id=(select id from categories where code='U10M')) as t2,
       (select id from teams where name='ACS Baschet Star 2017 Dacia') as t3;
grant select on ctx to authenticated;
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
insert into team_coaches select t1,'00000000-0000-0000-0000-000000000001' from ctx;
insert into team_coaches select t2,'00000000-0000-0000-0000-000000000002' from ctx;
insert into club_managers select id,'00000000-0000-0000-0000-000000000003' from clubs where name='ACS Baschet Star';

create or replace function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true);
$$;

set local role authenticated;

-- coach 1 adds a gym and proposes
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into gyms (name, city, created_by) values ('Sala LPS','Satu Mare', auth.uid());
insert into ids select 'p1', create_proposal((select grp from ctx),(select t1 from ctx),(select id from gyms where name='Sala LPS'),'2026-11-22',null,null,true);
-- coach 1 cannot respond to own proposal
do $$ begin perform respond_to_proposal((select v from ids where k='p1'), (select t1 from ctx), 'accept'); raise exception 'FAIL own'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;

-- coach 2 rejects without reason -> error; with reason ok
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
do $$ begin perform respond_to_proposal((select v from ids where k='p1'), (select t2 from ctx), 'reject', ''); raise exception 'FAIL reason'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
select respond_to_proposal((select v from ids where k='p1'), (select t2 from ctx), 'reject', 'Avem alt meci');
-- coach 2 cannot act for t3
do $$ begin perform respond_to_proposal((select v from ids where k='p1'), (select t3 from ctx), 'accept'); raise exception 'FAIL rights'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
-- coach 2 cannot insert games (not host)
do $$ begin insert into games (group_id, home_team_id, away_team_id, starts_at) select grp,t1,t2,now() from ctx; raise exception 'FAIL games'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;

-- coach 1 changes date -> responses reset
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
select update_proposal((select v from ids where k='p1'),(select id from gyms where name='Sala LPS'),'2026-11-29');
select count(*) = 0 as responses_reset from proposal_responses where proposal_id = (select v from ids where k='p1');

-- coach 2 + club manager accept -> auto confirmed
select pg_temp.as_user('00000000-0000-0000-0000-000000000002');
select respond_to_proposal((select v from ids where k='p1'), (select t2 from ctx), 'accept');
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
select respond_to_proposal((select v from ids where k='p1'), (select t3 from ctx), 'accept');
select status from group_overview where group_id=(select grp from ctx);

-- host adds games and result
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
insert into games (group_id, label, home_team_id, away_team_id, starts_at) select grp,'Meci 1',t1,t2,'2026-11-29 10:00+02' from ctx;
insert into games (group_id, label, home_team_id, away_team_id, starts_at) select grp,'Meci 2',t2,t3,'2026-11-29 12:00+02' from ctx;
update games set status='played', home_score=40, away_score=30 where label='Meci 1' and group_id=(select grp from ctx);
update games set status='forfeit_away' where label='Meci 2' and group_id=(select grp from ctx);
select tm.name, s.played, s.won, s.lost, s.points from group_standings s join teams tm on tm.id=s.team_id where s.group_id=(select grp from ctx) order by points desc;
select status from group_overview where group_id=(select grp from ctx);

-- conflict: second proposal in another group, admin decides
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
reset role;
create temp table g2 as select g.id from groups g join tournaments t on t.id=g.tournament_id join categories c on c.id=t.category_id where c.code='U10M' and g.name='Grupa 2 (SR5)';
grant select on g2 to authenticated;
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000003');
insert into ids select 'pa', create_proposal((select id from g2),(select id from teams where name='ACS Baschet Star 2018 Dacia'),(select id from gyms limit 1),'2026-11-23',null,null,true);
insert into ids select 'pb', create_proposal((select id from g2),(select id from teams where name='ACS Baschet Star 2017 Oltea'),(select id from gyms limit 1),'2026-11-24',null,null,true);
select status from group_overview where group_id=(select id from g2);
do $$ begin perform admin_confirm_proposal((select v from ids where k='pb')); raise exception 'FAIL admin'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select admin_confirm_proposal((select v from ids where k='pb'));
select status from group_overview where group_id=(select id from g2);
select hp.status, tm.name from hosting_proposals hp join teams tm on tm.id=hp.team_id where hp.group_id=(select id from g2) order by tm.name;

-- coach cannot promote themselves
select pg_temp.as_user('00000000-0000-0000-0000-000000000001');
do $$ begin update profiles set role='admin' where id=auth.uid(); raise exception 'FAIL role'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
select 'ALL TESTS PASSED' as result;
rollback;
