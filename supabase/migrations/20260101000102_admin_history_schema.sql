-- =========================================================================
-- PHASE 6: Administration -- one shared, cross-resource history table for
-- every Admin sub-domain, mirroring procurement_history's proven shape
-- (20260101000035) instead of a dozen separate per-table history tables
-- like asset_history/employee_history. A single resource_type discriminator
-- plus one log_admin_event() helper covers Requests/Locations/Rooms/
-- Workspaces/Assets/Vehicles/Travel/Visitors/Contracts/Compliance -- every
-- domain the Phase 6 spec asks for a timeline on.
-- =========================================================================
create table public.admin_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type text not null check (resource_type in (
    'ADMIN_REQUEST', 'LOCATION', 'BUILDING', 'FLOOR', 'ROOM', 'ROOM_BOOKING',
    'WORKSPACE', 'WORKSPACE_ASSIGNMENT', 'OFFICE_SUPPLY', 'OFFICE_SUPPLY_REQUEST',
    'ADMIN_ASSET', 'MAINTENANCE_RECORD', 'VEHICLE', 'VEHICLE_ASSIGNMENT',
    'TRAVEL_REQUEST', 'VISITOR', 'MEETING', 'EVENT', 'ADMIN_CONTRACT',
    'ADMIN_COMPLIANCE', 'ADMIN_DOCUMENT', 'ANNOUNCEMENT', 'COURIER_MAIL'
  )),
  resource_id uuid not null,
  event_type text not null,
  performed_by uuid references auth.users(id) on delete set null,
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create index admin_history_resource_idx on public.admin_history (company_id, resource_type, resource_id, created_at desc);

alter table public.admin_history enable row level security;

-- Read-only for anyone with company access and any ADMIN.*.VIEW-style
-- permission on the relevant area; write access is via the SECURITY
-- DEFINER helper below only (mirrors procurement_history/asset_history --
-- history is never directly writable by ordinary clients).
create policy "admin_history_select_members" on public.admin_history
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN'));

create or replace function public.log_admin_event(
  p_company_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_event_type text,
  p_previous_status text default null,
  p_new_status text default null,
  p_metadata jsonb default '{}',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.admin_history (
    company_id, resource_type, resource_id, event_type,
    performed_by, previous_status, new_status, metadata, notes
  ) values (
    p_company_id, p_resource_type, p_resource_id, p_event_type,
    auth.uid(), p_previous_status, p_new_status, coalesce(p_metadata, '{}'), p_notes
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.log_admin_event(uuid, text, uuid, text, text, text, jsonb, text) to authenticated;
