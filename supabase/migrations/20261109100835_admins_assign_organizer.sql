-- =============================================================================
-- Admins do not organise tournaments themselves: only coaches / club admins of
-- a team can volunteer ("Vreau să organizez") or answer proposals. Admins
-- choose the organiser: confirm a proposal, or assign a team directly.
-- =============================================================================

-- Teams the caller acts for as coach / club admin (no admin override)
create or replace function public.is_my_team(p_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_team_id in (select public.my_team_ids());
$$;

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
  if not public.is_my_team(p_team_id) then
    raise exception 'Doar antrenorii și administratorii clubului se pot oferi să organizeze';
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

create or replace function public.respond_to_proposal(
  p_proposal_id uuid,
  p_team_id uuid,
  p_response public.response_kind,
  p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_p public.hosting_proposals;
begin
  select * into v_p from public.hosting_proposals where id = p_proposal_id;
  if v_p.id is null then raise exception 'Propunere inexistentă'; end if;
  if v_p.status <> 'pending' then raise exception 'Propunerea nu mai așteaptă răspunsuri'; end if;
  if not public.is_my_team(p_team_id) then raise exception 'Fără drepturi'; end if;
  if p_team_id = v_p.team_id then raise exception 'Nu puteți răspunde propriei propuneri'; end if;
  if not exists (select 1 from public.group_teams where group_id = v_p.group_id and team_id = p_team_id) then
    raise exception 'Echipa nu face parte din această grupă';
  end if;
  if p_response = 'reject' and coalesce(length(trim(p_reason)), 0) = 0 then
    raise exception 'Motivul respingerii este obligatoriu';
  end if;

  insert into public.proposal_responses (proposal_id, team_id, response, reason, responded_by, responded_at)
  values (p_proposal_id, p_team_id, p_response, nullif(trim(p_reason), ''), auth.uid(), now())
  on conflict (proposal_id, team_id) do update
     set response = excluded.response, reason = excluded.reason,
         responded_by = excluded.responded_by, responded_at = now();

  perform public._try_auto_confirm(p_proposal_id);
end $$;

-- Admin of the group's region assigns the organiser directly.
-- Any other live proposal in the group becomes 'not_selected'.
create or replace function public.admin_assign_organizer(
  p_group_id uuid,
  p_team_id uuid,
  p_gym_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.can_admin_region(public.group_region(p_group_id)) then
    raise exception 'Doar administratorii regiunii pot desemna organizatorul';
  end if;
  if not exists (select 1 from public.group_teams where group_id = p_group_id and team_id = p_team_id) then
    raise exception 'Echipa nu face parte din această grupă';
  end if;

  update public.hosting_proposals set status = 'not_selected', updated_at = now()
   where group_id = p_group_id and team_id <> p_team_id and status in ('pending', 'confirmed');

  select id into v_id from public.hosting_proposals
   where group_id = p_group_id and team_id = p_team_id and status in ('pending', 'confirmed');

  if v_id is not null then
    update public.hosting_proposals
       set gym_id = p_gym_id, start_date = p_start_date, end_date = p_end_date,
           notes = nullif(trim(p_notes), ''), status = 'confirmed',
           confirmed_by_admin = true, auto_confirmed = false, updated_at = now()
     where id = v_id;
  else
    insert into public.hosting_proposals
      (group_id, team_id, proposed_by, gym_id, start_date, end_date, notes, conditions_text,
       status, confirmed_by_admin)
    values
      (p_group_id, p_team_id, auth.uid(), p_gym_id, p_start_date, p_end_date, nullif(trim(p_notes), ''),
       'Organizator desemnat de administrator.', 'confirmed', true)
    returning id into v_id;
  end if;

  update public.groups set confirmed_proposal_id = v_id where id = p_group_id;
  return v_id;
end $$;

grant execute on function public.admin_assign_organizer(uuid, uuid, uuid, date, date, text) to authenticated;
revoke execute on function public.admin_assign_organizer(uuid, uuid, uuid, date, date, text) from anon;
revoke execute on function public.is_my_team(uuid) from anon;
