-- =========================================================================
-- PHASE 6: Administration -- dashboard summary RPC. One efficient round
-- trip for every "Open X" / "Today's X" / "X Expiring" card the spec's
-- dashboard section (1) calls for -- every number is a real count against
-- the tables built in this phase, never a placeholder.
-- =========================================================================
create or replace function public.get_admin_dashboard_summary(p_company_id uuid)
returns table (
  open_requests bigint,
  pending_approvals bigint,
  today_visitors bigint,
  today_meetings bigint,
  upcoming_events bigint,
  low_stock_supplies bigint,
  maintenance_due bigint,
  contracts_expiring bigint,
  documents_expiring bigint,
  compliance_due bigint,
  vehicle_renewals bigint,
  upcoming_travel bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'ADMIN.DASHBOARD.VIEW') then
    raise exception 'Access denied';
  end if;

  return query select
    (select count(*) from public.admin_requests
      where company_id = p_company_id and status not in ('CLOSED', 'CANCELLED', 'REJECTED')),
    (select count(*) from public.admin_request_approvals ar
      join public.admin_requests r on r.id = ar.request_id
      where r.company_id = p_company_id and ar.decision = 'PENDING')
    + (select count(*) from public.travel_request_approvals ta
      join public.travel_requests t on t.id = ta.travel_request_id
      where t.company_id = p_company_id and ta.decision = 'PENDING'),
    (select count(*) from public.visitors where company_id = p_company_id and visit_date = current_date and status in ('EXPECTED', 'CHECKED_IN')),
    (select count(*) from public.meetings where company_id = p_company_id and meeting_date = current_date and status = 'SCHEDULED'),
    (select count(*) from public.events where company_id = p_company_id and start_date >= current_date and status in ('PLANNING', 'CONFIRMED')),
    (select count(*) from public.office_supplies where company_id = p_company_id and status = 'ACTIVE' and current_quantity <= minimum_quantity),
    (select count(*) from public.maintenance_records where company_id = p_company_id and status not in ('COMPLETED', 'CANCELLED'))
    + (select count(*) from public.maintenance_schedules where company_id = p_company_id and is_active and next_maintenance_date <= current_date + 30),
    (select count(*) from public.admin_contracts where company_id = p_company_id and status = 'EXPIRING'),
    (select count(*) from public.admin_documents where company_id = p_company_id and status = 'ACTIVE' and expiry_date is not null and expiry_date <= current_date + 30),
    (select count(*) from public.admin_compliance where company_id = p_company_id and status in ('EXPIRING', 'PENDING')),
    (select count(*) from public.vehicles where company_id = p_company_id and status not in ('RETIRED', 'DISPOSED')
      and ((registration_expiry is not null and registration_expiry <= current_date + 30) or (insurance_expiry is not null and insurance_expiry <= current_date + 30))),
    (select count(*) from public.travel_requests where company_id = p_company_id and status in ('APPROVED', 'BOOKED') and departure_date >= current_date);
end;
$$;

grant execute on function public.get_admin_dashboard_summary(uuid) to authenticated;
