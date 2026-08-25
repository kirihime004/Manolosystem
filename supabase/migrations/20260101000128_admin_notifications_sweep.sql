-- =========================================================================
-- PHASE 6: Administration -- generate_admin_notifications(), the sweep
-- function following the exact shape of generate_hr_notifications() /
-- generate_procurement_notifications() / generate_finance_notifications():
-- scans for time-based conditions and idempotently inserts into the
-- shared notifications table via ON CONFLICT DO NOTHING. Also advances
-- contract/compliance status (ACTIVE -> EXPIRING -> EXPIRED) the same
-- sweep pass runs, since both are date-driven state, not something a user
-- explicitly transitions.
-- =========================================================================
create or replace function public.generate_admin_notifications(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
begin
  if not public.has_permission(p_company_id, 'ADMIN.DASHBOARD.VIEW') then
    raise exception 'Access denied';
  end if;

  -- Contracts: ACTIVE -> EXPIRING (within 30 days) -> EXPIRED (past end_date).
  update public.admin_contracts set status = 'EXPIRING'
  where company_id = p_company_id and status = 'ACTIVE' and end_date <= current_date + 30;
  update public.admin_contracts set status = 'EXPIRED'
  where company_id = p_company_id and status in ('ACTIVE', 'EXPIRING') and end_date < current_date;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p_company_id, 'ADMIN_CONTRACT_EXPIRING', 'Contract expiring',
    c.contract_name || ' (' || c.contract_number || ') expires ' || c.end_date, 'admin_contract', c.id
  from public.admin_contracts c
  where c.company_id = p_company_id and c.status in ('EXPIRING', 'EXPIRED') and c.end_date <= current_date + 90
  on conflict (company_id, type, resource_type, resource_id) do nothing;
  get diagnostics v_count = row_count;

  -- Compliance: ACTIVE -> EXPIRING (within 30 days) -> EXPIRED.
  update public.admin_compliance set status = 'EXPIRING'
  where company_id = p_company_id and status = 'ACTIVE' and expiry_date is not null and expiry_date <= current_date + 30;
  update public.admin_compliance set status = 'EXPIRED'
  where company_id = p_company_id and status in ('ACTIVE', 'EXPIRING') and expiry_date is not null and expiry_date < current_date;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p_company_id, 'ADMIN_COMPLIANCE_EXPIRING', 'Compliance record expiring',
    cp.name || ' expires ' || cp.expiry_date, 'admin_compliance', cp.id
  from public.admin_compliance cp
  where cp.company_id = p_company_id and cp.status in ('EXPIRING', 'EXPIRED') and cp.expiry_date <= current_date + 90
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  -- Admin documents nearing expiry.
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p_company_id, 'ADMIN_DOCUMENT_EXPIRING', 'Document expiring',
    d.title || ' expires ' || d.expiry_date, 'admin_document', d.id
  from public.admin_documents d
  where d.company_id = p_company_id and d.status = 'ACTIVE' and d.expiry_date is not null and d.expiry_date <= current_date + 30
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  -- Preventive maintenance due / overdue.
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p_company_id, 'MAINTENANCE_OVERDUE', 'Maintenance overdue',
    ms.title || ' was due ' || ms.next_maintenance_date, 'maintenance_schedule', ms.id
  from public.maintenance_schedules ms
  where ms.company_id = p_company_id and ms.is_active and ms.next_maintenance_date < current_date
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p_company_id, 'MAINTENANCE_DUE', 'Maintenance due soon',
    ms.title || ' is due ' || ms.next_maintenance_date, 'maintenance_schedule', ms.id
  from public.maintenance_schedules ms
  where ms.company_id = p_company_id and ms.is_active
    and ms.next_maintenance_date >= current_date and ms.next_maintenance_date <= current_date + 30
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  -- Vehicle registration / insurance expiring.
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p_company_id, 'VEHICLE_REGISTRATION_EXPIRING', 'Vehicle registration expiring',
    v.plate_number || ' registration expires ' || v.registration_expiry, 'vehicle', v.id
  from public.vehicles v
  where v.company_id = p_company_id and v.status not in ('RETIRED', 'DISPOSED')
    and v.registration_expiry is not null and v.registration_expiry <= current_date + 30
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  select p_company_id, 'VEHICLE_INSURANCE_EXPIRING', 'Vehicle insurance expiring',
    v.plate_number || ' insurance expires ' || v.insurance_expiry, 'vehicle', v.id
  from public.vehicles v
  where v.company_id = p_company_id and v.status not in ('RETIRED', 'DISPOSED')
    and v.insurance_expiry is not null and v.insurance_expiry <= current_date + 30
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  -- Visitors expected today.
  insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
  select p_company_id, e.user_id, 'VISITOR_EXPECTED', 'Visitor expected today',
    vis.name || ' (' || coalesce(vis.organization, 'no organization') || ') is expected today', 'visitor', vis.id
  from public.visitors vis
  join public.employees e on e.id = vis.host_employee_id and e.user_id is not null
  where vis.company_id = p_company_id and vis.status = 'EXPECTED' and vis.visit_date = current_date
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.generate_admin_notifications(uuid) to authenticated;
