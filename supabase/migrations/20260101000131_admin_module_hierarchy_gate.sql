-- =========================================================================
-- Wires up the ten new Administration leaf keys, mirroring 071/099 exactly:
-- backfill a row per existing company (copying ADMIN's current enabled
-- state, so nothing changes in what's visible today), extend
-- has_module_enabled()'s cascade, and move every Admin table's select/
-- insert policies off the now-parent-only 'ADMIN' key onto the specific
-- leaf that owns that table. update/delete policies never checked the
-- module key to begin with (same as every other phase's tables), and
-- admin_history's own select policy stays on the parent 'ADMIN' key
-- deliberately -- it's cross-cutting history for every leaf's resources,
-- so no single leaf can own it.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Backfill: each of the ten leaves copies ADMIN's current value.
-- ---------------------------------------------------------------------
insert into public.company_modules (company_id, module_key, enabled)
select cm.company_id, sub.key, cm.enabled
from public.company_modules cm
cross join (values
  ('ADMIN_REQUESTS'::public.module_key),
  ('ADMIN_FACILITIES'::public.module_key),
  ('ADMIN_SUPPLIES'::public.module_key),
  ('ADMIN_ASSETS'::public.module_key),
  ('ADMIN_VEHICLES'::public.module_key),
  ('ADMIN_TRAVEL'::public.module_key),
  ('ADMIN_VISITORS'::public.module_key),
  ('ADMIN_EVENTS'::public.module_key),
  ('ADMIN_CONTRACTS'::public.module_key),
  ('ADMIN_COMMS'::public.module_key)
) as sub(key)
where cm.module_key = 'ADMIN'
on conflict (company_id, module_key) do nothing;

-- ---------------------------------------------------------------------
-- has_module_enabled(): extend the existing cascade with the ten new
-- Admin leaves. IT/HR/Finance cases are unchanged.
-- ---------------------------------------------------------------------
create or replace function public.has_module_enabled(p_company_id uuid, p_module_key public.module_key)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_parent_key public.module_key;
  v_own_enabled boolean;
  v_parent_enabled boolean;
begin
  if public.is_platform_superadmin() then
    return true;
  end if;

  v_parent_key := case p_module_key
    when 'TICKETING' then 'IT'
    when 'INVENTORY' then 'IT'
    when 'PROCUREMENT' then 'IT'
    when 'HR_EMPLOYEES' then 'HR'
    when 'HR_ATTENDANCE_LEAVE' then 'HR'
    when 'HR_PAYROLL' then 'HR'
    when 'FINANCE_ACCOUNTING' then 'FINANCE'
    when 'FINANCE_AP' then 'FINANCE'
    when 'FINANCE_AR' then 'FINANCE'
    when 'FINANCE_EXPENSES' then 'FINANCE'
    when 'FINANCE_BANK' then 'FINANCE'
    when 'FINANCE_PAYROLL' then 'FINANCE'
    when 'ADMIN_REQUESTS' then 'ADMIN'
    when 'ADMIN_FACILITIES' then 'ADMIN'
    when 'ADMIN_SUPPLIES' then 'ADMIN'
    when 'ADMIN_ASSETS' then 'ADMIN'
    when 'ADMIN_VEHICLES' then 'ADMIN'
    when 'ADMIN_TRAVEL' then 'ADMIN'
    when 'ADMIN_VISITORS' then 'ADMIN'
    when 'ADMIN_EVENTS' then 'ADMIN'
    when 'ADMIN_CONTRACTS' then 'ADMIN'
    when 'ADMIN_COMMS' then 'ADMIN'
    else null
  end;

  select exists (
    select 1 from public.company_modules cm
    where cm.company_id = p_company_id and cm.module_key = p_module_key and cm.enabled = true
  ) into v_own_enabled;

  if v_parent_key is null then
    return v_own_enabled;
  end if;

  select exists (
    select 1 from public.company_modules cm
    where cm.company_id = p_company_id and cm.module_key = v_parent_key and cm.enabled = true
  ) into v_parent_enabled;

  return v_own_enabled and v_parent_enabled;
end;
$$;

grant execute on function public.has_module_enabled(uuid, public.module_key) to authenticated;

-- ---------------------------------------------------------------------
-- ADMIN_REQUESTS -> admin_request_categories, admin_requests
-- ---------------------------------------------------------------------
drop policy "admin_request_categories_select_members" on public.admin_request_categories;
create policy "admin_request_categories_select_members" on public.admin_request_categories
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_REQUESTS'));

drop policy "admin_request_categories_write_admin" on public.admin_request_categories;
create policy "admin_request_categories_write_admin" on public.admin_request_categories
  for all
  using (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'ADMIN_REQUESTS'))
  )
  with check (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'ADMIN_REQUESTS'))
  );

drop policy "admin_requests_select" on public.admin_requests;
create policy "admin_requests_select" on public.admin_requests
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_REQUESTS')
    and (
      public.has_permission(company_id, 'ADMIN.REQUESTS.VIEW')
      or public.is_own_employee(requester_id)
      or assigned_to = auth.uid()
    )
  );

drop policy "admin_requests_insert" on public.admin_requests;
create policy "admin_requests_insert" on public.admin_requests
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_REQUESTS')
    and (public.has_permission(company_id, 'ADMIN.REQUESTS.CREATE') or public.is_own_employee(requester_id))
  );

-- ---------------------------------------------------------------------
-- ADMIN_FACILITIES -> locations, buildings, floors, rooms, room_bookings, workspaces
-- ---------------------------------------------------------------------
drop policy "locations_select" on public.locations;
create policy "locations_select" on public.locations
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.FACILITIES.VIEW'));
drop policy "locations_insert" on public.locations;
create policy "locations_insert" on public.locations
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.FACILITIES.CREATE'));

drop policy "buildings_select" on public.buildings;
create policy "buildings_select" on public.buildings
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.FACILITIES.VIEW'));
drop policy "buildings_insert" on public.buildings;
create policy "buildings_insert" on public.buildings
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.FACILITIES.CREATE'));

drop policy "floors_select" on public.floors;
create policy "floors_select" on public.floors
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.FACILITIES.VIEW'));
drop policy "floors_insert" on public.floors;
create policy "floors_insert" on public.floors
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.FACILITIES.CREATE'));

drop policy "rooms_select" on public.rooms;
create policy "rooms_select" on public.rooms
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.ROOMS.VIEW'));
drop policy "rooms_insert" on public.rooms;
create policy "rooms_insert" on public.rooms
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.ROOMS.CREATE'));

drop policy "room_bookings_insert" on public.room_bookings;
create policy "room_bookings_insert" on public.room_bookings
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES')
    and (public.has_permission(company_id, 'ADMIN.ROOMS.BOOK') or public.is_own_employee(requester_id))
  );

drop policy "workspaces_select" on public.workspaces;
create policy "workspaces_select" on public.workspaces
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.WORKSPACES.VIEW'));
drop policy "workspaces_insert" on public.workspaces;
create policy "workspaces_insert" on public.workspaces
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_FACILITIES') and public.has_permission(company_id, 'ADMIN.WORKSPACES.MANAGE'));

-- ---------------------------------------------------------------------
-- ADMIN_SUPPLIES -> office_supplies, office_supply_requests
-- ---------------------------------------------------------------------
drop policy "office_supplies_select" on public.office_supplies;
create policy "office_supplies_select" on public.office_supplies
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_SUPPLIES') and public.has_permission(company_id, 'ADMIN.SUPPLIES.VIEW'));
drop policy "office_supplies_insert" on public.office_supplies;
create policy "office_supplies_insert" on public.office_supplies
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_SUPPLIES') and public.has_permission(company_id, 'ADMIN.SUPPLIES.MANAGE'));

drop policy "office_supply_requests_insert" on public.office_supply_requests;
create policy "office_supply_requests_insert" on public.office_supply_requests
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_SUPPLIES')
    and (public.has_permission(company_id, 'ADMIN.SUPPLIES.VIEW') or public.is_own_employee(requester_id))
  );

-- ---------------------------------------------------------------------
-- ADMIN_ASSETS -> admin_assets, maintenance_records, maintenance_schedules
-- ---------------------------------------------------------------------
drop policy "admin_assets_select" on public.admin_assets;
create policy "admin_assets_select" on public.admin_assets
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_ASSETS')
    and (public.has_permission(company_id, 'ADMIN.ASSETS.VIEW') or public.is_own_employee(assigned_to))
  );
drop policy "admin_assets_insert" on public.admin_assets;
create policy "admin_assets_insert" on public.admin_assets
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_ASSETS') and public.has_permission(company_id, 'ADMIN.ASSETS.CREATE'));

drop policy "maintenance_records_select" on public.maintenance_records;
create policy "maintenance_records_select" on public.maintenance_records
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_ASSETS') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.VIEW'));
drop policy "maintenance_records_insert" on public.maintenance_records;
create policy "maintenance_records_insert" on public.maintenance_records
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_ASSETS') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.CREATE'));

drop policy "maintenance_schedules_select" on public.maintenance_schedules;
create policy "maintenance_schedules_select" on public.maintenance_schedules
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_ASSETS') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.VIEW'));
drop policy "maintenance_schedules_insert" on public.maintenance_schedules;
create policy "maintenance_schedules_insert" on public.maintenance_schedules
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_ASSETS') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.CREATE'));

-- ---------------------------------------------------------------------
-- ADMIN_VEHICLES -> vehicles
-- ---------------------------------------------------------------------
drop policy "vehicles_select" on public.vehicles;
create policy "vehicles_select" on public.vehicles
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_VEHICLES') and public.has_permission(company_id, 'ADMIN.VEHICLES.VIEW'));
drop policy "vehicles_insert" on public.vehicles;
create policy "vehicles_insert" on public.vehicles
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_VEHICLES') and public.has_permission(company_id, 'ADMIN.VEHICLES.MANAGE'));

-- ---------------------------------------------------------------------
-- ADMIN_TRAVEL -> travel_requests
-- ---------------------------------------------------------------------
drop policy "travel_requests_select" on public.travel_requests;
create policy "travel_requests_select" on public.travel_requests
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_TRAVEL')
    and (public.has_permission(company_id, 'ADMIN.TRAVEL.VIEW') or public.is_own_employee(employee_id))
  );
drop policy "travel_requests_insert" on public.travel_requests;
create policy "travel_requests_insert" on public.travel_requests
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_TRAVEL')
    and (public.has_permission(company_id, 'ADMIN.TRAVEL.CREATE') or public.is_own_employee(employee_id))
  );

-- ---------------------------------------------------------------------
-- ADMIN_VISITORS -> visitors, meetings
-- ---------------------------------------------------------------------
drop policy "visitors_select" on public.visitors;
create policy "visitors_select" on public.visitors
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_VISITORS')
    and (public.has_permission(company_id, 'ADMIN.VISITORS.VIEW') or public.is_own_employee(host_employee_id))
  );
drop policy "visitors_insert" on public.visitors;
create policy "visitors_insert" on public.visitors
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_VISITORS')
    and (public.has_permission(company_id, 'ADMIN.VISITORS.CREATE') or public.is_own_employee(host_employee_id))
  );

drop policy "meetings_insert" on public.meetings;
create policy "meetings_insert" on public.meetings
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_VISITORS')
    and (public.has_permission(company_id, 'ADMIN.MEETINGS.CREATE') or public.is_own_employee(organizer_id))
  );

-- ---------------------------------------------------------------------
-- ADMIN_EVENTS -> events
-- ---------------------------------------------------------------------
drop policy "events_select" on public.events;
create policy "events_select" on public.events
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_EVENTS') and public.has_permission(company_id, 'ADMIN.EVENTS.VIEW'));
drop policy "events_insert" on public.events;
create policy "events_insert" on public.events
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_EVENTS') and public.has_permission(company_id, 'ADMIN.EVENTS.CREATE'));

-- ---------------------------------------------------------------------
-- ADMIN_CONTRACTS -> admin_contracts, admin_compliance, admin_documents
-- ---------------------------------------------------------------------
drop policy "admin_contracts_select" on public.admin_contracts;
create policy "admin_contracts_select" on public.admin_contracts
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_CONTRACTS') and public.has_permission(company_id, 'ADMIN.CONTRACTS.VIEW'));
drop policy "admin_contracts_insert" on public.admin_contracts;
create policy "admin_contracts_insert" on public.admin_contracts
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_CONTRACTS') and public.has_permission(company_id, 'ADMIN.CONTRACTS.CREATE'));

drop policy "admin_compliance_select" on public.admin_compliance;
create policy "admin_compliance_select" on public.admin_compliance
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_CONTRACTS') and public.has_permission(company_id, 'ADMIN.COMPLIANCE.VIEW'));
drop policy "admin_compliance_insert" on public.admin_compliance;
create policy "admin_compliance_insert" on public.admin_compliance
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_CONTRACTS') and public.has_permission(company_id, 'ADMIN.COMPLIANCE.CREATE'));

drop policy "admin_documents_select" on public.admin_documents;
create policy "admin_documents_select" on public.admin_documents
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_CONTRACTS') and public.has_permission(company_id, 'ADMIN.DOCUMENTS.VIEW'));
drop policy "admin_documents_insert" on public.admin_documents;
create policy "admin_documents_insert" on public.admin_documents
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_CONTRACTS') and public.has_permission(company_id, 'ADMIN.DOCUMENTS.UPLOAD'));

-- ---------------------------------------------------------------------
-- ADMIN_COMMS -> announcements, courier_mail
-- ---------------------------------------------------------------------
drop policy "announcements_insert" on public.announcements;
create policy "announcements_insert" on public.announcements
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_COMMS') and public.has_permission(company_id, 'ADMIN.ANNOUNCEMENTS.CREATE'));

drop policy "courier_mail_select" on public.courier_mail;
create policy "courier_mail_select" on public.courier_mail
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_COMMS') and public.has_permission(company_id, 'ADMIN.COURIER.VIEW'));
drop policy "courier_mail_insert" on public.courier_mail;
create policy "courier_mail_insert" on public.courier_mail
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN_COMMS') and public.has_permission(company_id, 'ADMIN.COURIER.MANAGE'));
