-- Some officials invoice the club themselves for a game: the amount is not paid
-- through the region (left out of the Decont) but still counts in their activity report.
alter table public.game_officials add column self_invoiced boolean not null default false;

-- Only the master admin changes a nomination's amount or the "self-invoiced" mark
create or replace function public.protect_fee_override()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.fee_override is distinct from old.fee_override or new.self_invoiced is distinct from old.self_invoiced)
     and current_user in ('authenticated', 'anon')
     and not public.is_master_admin() then
    raise exception 'Doar administratorul principal poate modifica suma sau facturarea';
  end if;
  return new;
end $$;
