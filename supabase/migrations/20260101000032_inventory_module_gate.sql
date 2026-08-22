-- Backfill the new INVENTORY module onto every existing company (disabled
-- by default -- Platform Superadmin turns it on per company, same as any
-- other module). seed_company_defaults() already provisions every module
-- key dynamically via enum_range(), so new companies get this for free.
insert into public.company_modules (company_id, module_key, enabled)
select c.id, 'INVENTORY', false
from public.companies c
on conflict (company_id, module_key) do nothing;

-- =========================================================================
-- Re-scope every inventory-family RLS policy to also require the
-- INVENTORY module to be enabled -- belt-and-suspenders with the frontend
-- RequireModule guard, exactly like has_module_enabled(company_id, 'IT')
-- already gates the ticketing tables.
-- =========================================================================

drop policy "suppliers_select" on public.suppliers;
create policy "suppliers_select" on public.suppliers
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.VIEW')
  );
drop policy "suppliers_insert" on public.suppliers;
create policy "suppliers_insert" on public.suppliers
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.CREATE')
  );
drop policy "suppliers_update" on public.suppliers;
create policy "suppliers_update" on public.suppliers
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.UPDATE')
  );
drop policy "suppliers_delete" on public.suppliers;
create policy "suppliers_delete" on public.suppliers
  for delete using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.DELETE')
  );

drop policy "assets_select" on public.assets;
create policy "assets_select" on public.assets
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.VIEW')
  );
drop policy "assets_select_own_assignment" on public.assets;
create policy "assets_select_own_assignment" on public.assets
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and assigned_to = auth.uid()
  );
drop policy "assets_insert" on public.assets;
create policy "assets_insert" on public.assets
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.CREATE')
  );
drop policy "assets_update" on public.assets;
create policy "assets_update" on public.assets
  for update
  using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'INVENTORY')
    and (
      public.has_permission(company_id, 'IT.INVENTORY.UPDATE')
      or public.has_permission(company_id, 'IT.INVENTORY.ASSIGN')
      or public.has_permission(company_id, 'IT.INVENTORY.DISPOSE')
      or public.has_permission(company_id, 'IT.INVENTORY.REPAIR')
    )
  )
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY'));
drop policy "assets_delete" on public.assets;
create policy "assets_delete" on public.assets
  for delete using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.DELETE')
  );

drop policy "hardware_details_select" on public.hardware_details;
create policy "hardware_details_select" on public.hardware_details
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.VIEW')
  );
drop policy "hardware_details_insert" on public.hardware_details;
create policy "hardware_details_insert" on public.hardware_details
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.CREATE')
  );
drop policy "hardware_details_update" on public.hardware_details;
create policy "hardware_details_update" on public.hardware_details
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.UPDATE')
  );

drop policy "software_details_select" on public.software_details;
create policy "software_details_select" on public.software_details
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.VIEW')
  );
drop policy "software_details_insert" on public.software_details;
create policy "software_details_insert" on public.software_details
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.CREATE')
  );
drop policy "software_details_update" on public.software_details;
create policy "software_details_update" on public.software_details
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.UPDATE')
  );

drop policy "software_subscriptions_select" on public.software_subscriptions;
create policy "software_subscriptions_select" on public.software_subscriptions
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.VIEW')
  );
drop policy "software_subscriptions_insert" on public.software_subscriptions;
create policy "software_subscriptions_insert" on public.software_subscriptions
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.CREATE')
  );
drop policy "software_subscriptions_update" on public.software_subscriptions;
create policy "software_subscriptions_update" on public.software_subscriptions
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.UPDATE')
  );

drop policy "asset_history_select" on public.asset_history;
create policy "asset_history_select" on public.asset_history
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.VIEW')
  );

drop policy "repairs_select" on public.repairs;
create policy "repairs_select" on public.repairs
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and (public.has_permission(company_id, 'IT.INVENTORY.VIEW') or public.has_permission(company_id, 'IT.INVENTORY.REPAIR'))
  );
drop policy "repairs_insert" on public.repairs;
create policy "repairs_insert" on public.repairs
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.REPAIR')
  );
drop policy "repairs_update" on public.repairs;
create policy "repairs_update" on public.repairs
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.REPAIR')
  );

drop policy "disposals_select" on public.disposals;
create policy "disposals_select" on public.disposals
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and (public.has_permission(company_id, 'IT.INVENTORY.VIEW') or public.has_permission(company_id, 'IT.INVENTORY.DISPOSE'))
  );
drop policy "disposals_insert" on public.disposals;
create policy "disposals_insert" on public.disposals
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.INVENTORY.DISPOSE')
  );

drop policy "ip_addresses_select" on public.ip_addresses;
create policy "ip_addresses_select" on public.ip_addresses
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.IP.VIEW')
  );
drop policy "ip_addresses_insert" on public.ip_addresses;
create policy "ip_addresses_insert" on public.ip_addresses
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and (public.has_permission(company_id, 'IT.IP.UPDATE') or public.has_permission(company_id, 'IT.IP.MANAGE'))
  );
drop policy "ip_addresses_update" on public.ip_addresses;
create policy "ip_addresses_update" on public.ip_addresses
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and (public.has_permission(company_id, 'IT.IP.UPDATE') or public.has_permission(company_id, 'IT.IP.MANAGE'))
  );
drop policy "ip_addresses_delete" on public.ip_addresses;
create policy "ip_addresses_delete" on public.ip_addresses
  for delete using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.IP.MANAGE')
  );

drop policy "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
    and (user_id is null or user_id = auth.uid())
  );
drop policy "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
    and (user_id is null or user_id = auth.uid())
  );

drop policy "network_agent_tokens_select" on public.network_agent_tokens;
create policy "network_agent_tokens_select" on public.network_agent_tokens
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.IP.MANAGE')
  );
drop policy "network_agent_tokens_insert" on public.network_agent_tokens;
create policy "network_agent_tokens_insert" on public.network_agent_tokens
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.IP.MANAGE')
  );
drop policy "network_agent_tokens_update" on public.network_agent_tokens;
create policy "network_agent_tokens_update" on public.network_agent_tokens
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.IP.MANAGE')
  );

drop policy "credentials_select" on public.credentials;
create policy "credentials_select" on public.credentials
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.CREDENTIALS.VIEW')
  );
drop policy "credentials_insert" on public.credentials;
create policy "credentials_insert" on public.credentials
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.CREDENTIALS.CREATE')
  );
drop policy "credentials_update" on public.credentials;
create policy "credentials_update" on public.credentials
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.CREDENTIALS.UPDATE')
  );
drop policy "credentials_delete" on public.credentials;
create policy "credentials_delete" on public.credentials
  for delete using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'INVENTORY')
    and public.has_permission(company_id, 'IT.CREDENTIALS.DELETE')
  );

-- Companies that already have inventory data (i.e. were already using this
-- feature before the toggle existed) keep working instead of suddenly
-- losing access the moment this migration ships.
update public.company_modules
set enabled = true
where module_key = 'INVENTORY'
  and company_id in (select company_id from public.assets);
