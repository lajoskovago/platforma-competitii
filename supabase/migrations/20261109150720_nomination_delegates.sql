-- =============================================================================
-- Nomination delegates: the master admin can allow chosen people (typically
-- experienced referees) to nominate referees / table officials for the games of
-- their region – the same nomination rights as a regional admin, nothing more.
-- =============================================================================

alter table public.profiles add column can_nominate boolean not null default false;
alter table public.profiles add constraint profiles_delegate_region
  check (not can_nominate or region is not null);

-- Admin of the region, or a delegate of that region (null region = mixed group: both regions).
create or replace function public.can_nominate_region(p_region public.region)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_admin_region(p_region)
      or exists (select 1 from public.profiles
                  where id = auth.uid() and can_nominate
                    and (p_region is null or region = p_region));
$$;

-- Anyone who may nominate somewhere (used for reading unavailability).
create or replace function public.can_nominate_any()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or exists (select 1 from public.profiles where id = auth.uid() and can_nominate);
$$;

-- Nominations: delegates get the same rights as the regional admin
drop policy "read_visible" on public.game_officials;
create policy "read_visible" on public.game_officials for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_nominate_region(public.game_region(game_id))
    or (status = 'accepted' and public.can_view_game(game_id))
  );

drop policy "admin_insert" on public.game_officials;
drop policy "admin_update" on public.game_officials;
drop policy "admin_delete" on public.game_officials;
create policy "nominator_insert" on public.game_officials for insert to authenticated
  with check (public.can_nominate_region(public.game_region(game_id)));
create policy "nominator_update" on public.game_officials for update to authenticated
  using (public.can_nominate_region(public.game_region(game_id)))
  with check (public.can_nominate_region(public.game_region(game_id)));
create policy "nominator_delete" on public.game_officials for delete to authenticated
  using (public.can_nominate_region(public.game_region(game_id)));

-- Region of a person (no contact data; profiles themselves stay protected)
create or replace function public.profile_region(p_user_id uuid)
returns public.region language sql stable security definer set search_path = '' as $$
  select region from public.profiles where id = p_user_id;
$$;
revoke execute on function public.profile_region(uuid) from anon;

-- Unavailability: own rows; master sees all; regional admins / delegates see their region
drop policy "own_or_admin_read" on public.official_unavailability;
create policy "own_or_nominator_read" on public.official_unavailability for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_master_admin()
    or (public.can_nominate_any()
        and public.profile_region(user_id) = public.my_region())
  );

-- Only the master admin grants / removes the delegation.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new; -- service role / migrations
  end if;
  if (new.role is distinct from old.role or new.can_nominate is distinct from old.can_nominate)
     and not public.is_master_admin() then
    raise exception 'Doar administratorul principal poate schimba rolul sau dreptul de nominalizare';
  end if;
  if (new.email, new.region, new.is_referee, new.is_table_official)
       is distinct from (old.email, old.region, old.is_referee, old.is_table_official)
     and not public.is_admin() then
    raise exception 'Nu puteți modifica aceste date';
  end if;
  if old.id <> auth.uid() and old.role <> 'user' and not public.is_master_admin() then
    raise exception 'Nu puteți modifica un administrator';
  end if;
  return new;
end $$;

revoke execute on function public.can_nominate_region(public.region) from anon;
revoke execute on function public.can_nominate_any() from anon;
