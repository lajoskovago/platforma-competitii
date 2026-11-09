-- Club admins manage their club's teams in the NATIONAL championship
-- (regional teams belong to groups and stay with the administrators).

create or replace function public.is_club_manager(p_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_managers where club_id = p_club_id and user_id = auth.uid());
$$;

create or replace function public.is_national_category(p_category_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.categories where id = p_category_id and scope = 'national');
$$;

create policy "club_admin_insert_national_team" on public.teams for insert to authenticated
  with check (public.is_club_manager(club_id) and public.is_national_category(category_id));

create policy "club_admin_update_national_team" on public.teams for update to authenticated
  using (public.is_club_manager(club_id) and public.is_national_category(category_id))
  with check (public.is_club_manager(club_id) and public.is_national_category(category_id));

create policy "club_admin_delete_national_team" on public.teams for delete to authenticated
  using (public.is_club_manager(club_id) and public.is_national_category(category_id));

revoke execute on function public.is_club_manager(uuid) from anon;
revoke execute on function public.is_national_category(uuid) from anon;
