-- =============================================================================
-- Temporary auto-confirmation of hosting proposals
--   While app_settings.auto_confirm_until is in the future, a proposal is
--   confirmed immediately when it is the only live proposal in its group
--   (no acceptance from the other teams needed). If another team already has a
--   live proposal, the normal flow applies (admin decides).
--   Initial value: end of Sunday 15 Nov 2026 (first weekend of games).
-- =============================================================================

create table public.app_settings (
  id                  boolean primary key default true check (id), -- single row
  auto_confirm_until  timestamptz,
  updated_by          uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now()
);
insert into public.app_settings (auto_confirm_until)
values ('2026-11-16 00:00:00 Europe/Bucharest');

alter table public.app_settings enable row level security;
create policy "read_authenticated" on public.app_settings for select to authenticated using (true);
create policy "master_update" on public.app_settings for update to authenticated
  using (public.is_master_admin()) with check (public.is_master_admin());

alter table public.hosting_proposals add column auto_confirmed boolean not null default false;

create or replace function public.auto_confirm_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auto_confirm_until > now() from public.app_settings), false);
$$;

-- Confirm right away if auto-confirmation is active and this is the only live proposal.
create or replace function public._auto_confirm_if_active(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_group uuid;
begin
  if not public.auto_confirm_active() then return; end if;
  select group_id into v_group from public.hosting_proposals where id = p_proposal_id and status = 'pending';
  if v_group is null then return; end if;
  if (select count(*) from public.hosting_proposals
       where group_id = v_group and status in ('pending', 'confirmed')) <> 1 then
    return;
  end if;
  update public.hosting_proposals
     set status = 'confirmed', auto_confirmed = true, updated_at = now()
   where id = p_proposal_id;
  update public.groups set confirmed_proposal_id = p_proposal_id where id = v_group;
end $$;
revoke execute on function public._auto_confirm_if_active(uuid) from public, anon, authenticated;

create or replace function public.create_proposal(
  p_group_id uuid,
  p_team_id uuid,
  p_gym_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null,
  p_conditions_accepted boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Neautentificat'; end if;
  if not public.can_act_for_team(p_team_id) then
    raise exception 'Nu aveți drept de acțiune pentru această echipă';
  end if;
  if not exists (select 1 from public.group_teams where group_id = p_group_id and team_id = p_team_id) then
    raise exception 'Echipa nu face parte din această grupă';
  end if;
  if not coalesce(p_conditions_accepted, false) then
    raise exception 'Trebuie să acceptați condițiile de organizare';
  end if;
  if exists (select 1 from public.groups where id = p_group_id and confirmed_proposal_id is not null) then
    raise exception 'Grupa are deja un organizator confirmat';
  end if;

  begin
    insert into public.hosting_proposals
      (group_id, team_id, proposed_by, gym_id, start_date, end_date, notes, conditions_text)
    values
      (p_group_id, p_team_id, auth.uid(), p_gym_id, p_start_date, p_end_date,
       nullif(trim(p_notes), ''), public.app_conditions_text())
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'Echipa are deja o propunere activă în această grupă';
  end;

  perform public._auto_confirm_if_active(v_id);
  return v_id;
end $$;

create or replace function public.update_proposal(
  p_proposal_id uuid,
  p_gym_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
begin
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if not public.can_act_for_team(v_p.team_id) then raise exception 'Fără drepturi'; end if;
  if v_p.status not in ('pending', 'confirmed') then
    raise exception 'Propunerea nu mai este activă';
  end if;

  update public.hosting_proposals
     set gym_id = p_gym_id, start_date = p_start_date, end_date = p_end_date,
         notes = nullif(trim(p_notes), ''), status = 'pending',
         confirmed_by_admin = false, auto_confirmed = false, updated_at = now()
   where id = p_proposal_id;

  delete from public.proposal_responses where proposal_id = p_proposal_id;
  update public.groups set confirmed_proposal_id = null
   where id = v_p.group_id and confirmed_proposal_id = p_proposal_id;

  perform public._auto_confirm_if_active(p_proposal_id);
end $$;

-- When a competing proposal is withdrawn, the remaining one may now be confirmed.
create or replace function public.withdraw_proposal(p_proposal_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
  v_other uuid;
begin
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if not public.can_act_for_team(v_p.team_id) then raise exception 'Fără drepturi'; end if;
  if v_p.status not in ('pending', 'confirmed') then
    raise exception 'Propunerea nu mai este activă';
  end if;

  update public.hosting_proposals set status = 'withdrawn', updated_at = now()
   where id = p_proposal_id;
  update public.groups set confirmed_proposal_id = null
   where id = v_p.group_id and confirmed_proposal_id = p_proposal_id;

  for v_other in select id from public.hosting_proposals
                  where group_id = v_p.group_id and status = 'pending' loop
    perform public._try_auto_confirm(v_other);
    perform public._auto_confirm_if_active(v_other);
  end loop;
end $$;
