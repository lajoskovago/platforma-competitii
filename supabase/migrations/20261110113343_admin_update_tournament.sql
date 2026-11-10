-- Admin (master / regional admin of the group's region) changes the date and/or gym
-- of a tournament whose organiser is already confirmed. The confirmation stays.
-- Optionally the scheduled games move along: same clock times, shifted by the
-- number of days the start date moved; games at the old gym go to the new gym.
create or replace function public.admin_update_tournament(
  p_group_id uuid,
  p_gym_id uuid,
  p_start_date date,
  p_end_date date default null,
  p_notes text default null,
  p_move_games boolean default true
) returns void
language plpgsql security definer
set search_path = ''
set timezone = 'Europe/Bucharest'  -- "+ n days" keeps the Romanian clock time across DST changes
as $$
declare
  v_p public.hosting_proposals;
  v_shift int;
begin
  if not public.can_admin_region(public.group_region(p_group_id)) then
    raise exception 'Doar administratorii regiunii pot modifica turneul';
  end if;
  if p_end_date is not null and p_end_date < p_start_date then
    raise exception 'Data de final este înaintea datei de început';
  end if;

  select hp.* into v_p
    from public.groups g join public.hosting_proposals hp on hp.id = g.confirmed_proposal_id
   where g.id = p_group_id;
  if v_p.id is null then raise exception 'Grupa nu are un organizator confirmat'; end if;

  v_shift := p_start_date - v_p.start_date;

  update public.hosting_proposals
     set gym_id = p_gym_id,
         start_date = p_start_date,
         end_date = case when p_end_date is null or p_end_date = p_start_date then null else p_end_date end,
         notes = coalesce(nullif(trim(p_notes), ''), notes),
         updated_at = now()
   where id = v_p.id;

  if p_move_games then
    update public.games
       set starts_at = starts_at + make_interval(days => v_shift),
           gym_id = case when gym_id is null or gym_id = v_p.gym_id then p_gym_id else gym_id end
     where group_id = p_group_id;
  end if;
end $$;

grant execute on function public.admin_update_tournament(uuid, uuid, date, date, text, boolean) to authenticated;
revoke execute on function public.admin_update_tournament(uuid, uuid, date, date, text, boolean) from anon;
