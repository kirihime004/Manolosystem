-- Lets anyone see the assets assigned specifically to them, even without
-- IT.INVENTORY.VIEW -- otherwise a regular employee filing "my laptop won't
-- boot" couldn't find their own laptop in the ticket form's asset picker.
-- Combined with assets_select, RLS naturally scopes searchAssetsForTicket()
-- correctly for both audiences: IT staff (INVENTORY.VIEW) see everything,
-- everyone else only ever sees their own equipment.
create policy "assets_select_own_assignment" on public.assets
  for select
  using (public.has_company_access(company_id) and assigned_to = auth.uid());
