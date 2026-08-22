-- =========================================================================
-- PHASE 2: RLS policies for every inventory table.
-- Every policy pivots on has_company_access(company_id) (tenant boundary)
-- plus a specific has_permission() check (feature boundary) -- the same
-- two-function pattern the ticketing module already uses, so Company A can
-- never see Company B's rows no matter which permission it holds.
-- =========================================================================

-- ---------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------
create policy "suppliers_select" on public.suppliers
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.VIEW'));

create policy "suppliers_insert" on public.suppliers
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.CREATE'));

create policy "suppliers_update" on public.suppliers
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.UPDATE'));

create policy "suppliers_delete" on public.suppliers
  for delete using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.DELETE'));

-- asset_code_counters: no client-facing policies at all (like ticket_sequences)
-- -- only touched via the SECURITY DEFINER generate_asset_code() function.

-- ---------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------
create policy "assets_select" on public.assets
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.VIEW'));

create policy "assets_insert" on public.assets
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.CREATE'));

-- Column-level enforcement lives in before_update_asset(); this just gates
-- who may attempt an update at all.
create policy "assets_update" on public.assets
  for update
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'IT.INVENTORY.UPDATE')
      or public.has_permission(company_id, 'IT.INVENTORY.ASSIGN')
      or public.has_permission(company_id, 'IT.INVENTORY.DISPOSE')
      or public.has_permission(company_id, 'IT.INVENTORY.REPAIR')
    )
  )
  with check (public.has_company_access(company_id));

create policy "assets_delete" on public.assets
  for delete using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.DELETE'));

-- Disposed assets must remain in the database permanently -- block delete
-- at the trigger layer too, not just by omitting it from the UI.
create or replace function public.protect_disposed_assets()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'DISPOSED' then
    raise exception 'Disposed assets cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger protect_disposed_assets_trigger
  before delete on public.assets
  for each row execute function public.protect_disposed_assets();

-- ---------------------------------------------------------------------
-- hardware_details / software_details / software_subscriptions
-- ---------------------------------------------------------------------
create policy "hardware_details_select" on public.hardware_details
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.VIEW'));
create policy "hardware_details_insert" on public.hardware_details
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.CREATE'));
create policy "hardware_details_update" on public.hardware_details
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.UPDATE'));

create policy "software_details_select" on public.software_details
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.VIEW'));
create policy "software_details_insert" on public.software_details
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.CREATE'));
create policy "software_details_update" on public.software_details
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.UPDATE'));

create policy "software_subscriptions_select" on public.software_subscriptions
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.VIEW'));
create policy "software_subscriptions_insert" on public.software_subscriptions
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.CREATE'));
create policy "software_subscriptions_update" on public.software_subscriptions
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.UPDATE'));

-- ---------------------------------------------------------------------
-- asset_history: read-only for clients, written exclusively by triggers.
-- ---------------------------------------------------------------------
create policy "asset_history_select" on public.asset_history
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.VIEW'));

-- ---------------------------------------------------------------------
-- repairs
-- ---------------------------------------------------------------------
create policy "repairs_select" on public.repairs
  for select using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'IT.INVENTORY.VIEW') or public.has_permission(company_id, 'IT.INVENTORY.REPAIR'))
  );
create policy "repairs_insert" on public.repairs
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.REPAIR'));
create policy "repairs_update" on public.repairs
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.REPAIR'));

-- ---------------------------------------------------------------------
-- disposals: immutable once created, like audit_logs.
-- ---------------------------------------------------------------------
create policy "disposals_select" on public.disposals
  for select using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'IT.INVENTORY.VIEW') or public.has_permission(company_id, 'IT.INVENTORY.DISPOSE'))
  );
create policy "disposals_insert" on public.disposals
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.INVENTORY.DISPOSE'));

-- ---------------------------------------------------------------------
-- ip_addresses
-- ---------------------------------------------------------------------
create policy "ip_addresses_select" on public.ip_addresses
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.IP.VIEW'));
create policy "ip_addresses_insert" on public.ip_addresses
  for insert with check (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'IT.IP.UPDATE') or public.has_permission(company_id, 'IT.IP.MANAGE'))
  );
create policy "ip_addresses_update" on public.ip_addresses
  for update using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'IT.IP.UPDATE') or public.has_permission(company_id, 'IT.IP.MANAGE'))
  );
create policy "ip_addresses_delete" on public.ip_addresses
  for delete using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.IP.MANAGE'));

-- ---------------------------------------------------------------------
-- notifications: visible if broadcast (user_id is null) or addressed to
-- the caller specifically, and only with the NOTIFICATIONS.VIEW permission.
-- ---------------------------------------------------------------------
create policy "notifications_select" on public.notifications
  for select using (
    public.has_company_access(company_id)
    and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
    and (user_id is null or user_id = auth.uid())
  );

create policy "notifications_update" on public.notifications
  for update using (
    public.has_company_access(company_id)
    and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
    and (user_id is null or user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- network_agent_tokens: only IT.IP.MANAGE holders may create/revoke.
-- The plaintext token itself is never stored -- see the
-- network-agent-ingest Edge Function, which hashes the caller's token and
-- looks it up here.
-- ---------------------------------------------------------------------
create policy "network_agent_tokens_select" on public.network_agent_tokens
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.IP.MANAGE'));
create policy "network_agent_tokens_insert" on public.network_agent_tokens
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.IP.MANAGE'));
create policy "network_agent_tokens_update" on public.network_agent_tokens
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.IP.MANAGE'));

-- ---------------------------------------------------------------------
-- credentials: VIEW only ever exposes the encrypted blob, never the
-- plaintext -- decryption happens exclusively inside the credential-reveal
-- Edge Function, gated by IT.CREDENTIALS.REVEAL and separately audited.
-- ---------------------------------------------------------------------
create policy "credentials_select" on public.credentials
  for select using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.CREDENTIALS.VIEW'));
create policy "credentials_insert" on public.credentials
  for insert with check (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.CREDENTIALS.CREATE'));
create policy "credentials_update" on public.credentials
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.CREDENTIALS.UPDATE'));
create policy "credentials_delete" on public.credentials
  for delete using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.CREDENTIALS.DELETE'));
