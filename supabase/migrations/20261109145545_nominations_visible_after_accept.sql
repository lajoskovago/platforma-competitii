-- Nominations visibility:
--   - admins of the game's region (and the master admin): every nomination, with status and refusal reason
--   - the nominated person: their own nominations
--   - everyone else who can see the game (coaches, club admins, other officials):
--     only nominations the official has ACCEPTED
drop policy "read_visible" on public.game_officials;

create policy "read_visible" on public.game_officials for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_admin_region(public.game_region(game_id))
    or (status = 'accepted' and public.can_view_game(game_id))
  );
