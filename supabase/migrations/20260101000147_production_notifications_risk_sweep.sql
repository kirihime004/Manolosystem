-- =========================================================================
-- PHASE 7: Notification types + the two periodic sweep RPCs (risk
-- recalculation and notification generation), mirroring
-- generate_admin_notifications() exactly. Widening the notifications.type
-- CHECK constraint re-lists the entire existing list plus the new
-- Production types, per the hand-maintained-cumulative-constraint
-- convention every phase has used.
-- =========================================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'HARDWARE_NEARING_EOL', 'HARDWARE_OVER_EOL', 'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED',
  'SUBSCRIPTION_RENEWAL_DUE', 'SUBSCRIPTION_EXPIRED', 'IP_CONFLICT', 'ASSET_DEFECTIVE', 'REPAIR_OVERDUE',
  'PR_SUBMITTED', 'PR_APPROVED', 'PR_REJECTED', 'PO_AWAITING_APPROVAL', 'PO_APPROVED', 'PO_SENT_TO_SUPPLIER',
  'DELIVERY_OVERDUE', 'DELIVERY_PARTIAL', 'BUDGET_THRESHOLD', 'BUDGET_PERIOD_ENDING',
  'NEW_EMPLOYEE', 'ONBOARDING_TASK', 'OFFBOARDING_TASK', 'PROBATION_ENDING', 'CONTRACT_EXPIRING', 'DOCUMENT_EXPIRING',
  'LEAVE_SUBMITTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
  'ATTENDANCE_CORRECTION_SUBMITTED', 'ATTENDANCE_CORRECTION_APPROVED', 'ATTENDANCE_CORRECTION_REJECTED',
  'OVERTIME_SUBMITTED', 'OVERTIME_APPROVED', 'OVERTIME_REJECTED', 'PAYROLL_PENDING', 'EMPLOYEE_TERMINATED',
  'HR_REQUEST_SUBMITTED', 'HR_REQUEST_UNDER_REVIEW', 'HR_REQUEST_APPROVED', 'HR_REQUEST_REJECTED', 'HR_REQUEST_COMPLETED', 'HR_REQUEST_CANCELLED',
  'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'EXPENSE_REJECTED', 'PAYMENT_COMPLETED', 'PAYROLL_APPROVED', 'PAYROLL_PAID',
  'INVOICE_DUE', 'INVOICE_OVERDUE', 'BILL_DUE', 'BILL_OVERDUE', 'TAX_DEADLINE', 'FINANCIAL_PERIOD_CLOSING', 'BANK_RECONCILIATION_REQUIRED',
  'ADMIN_REQUEST_SUBMITTED', 'ADMIN_REQUEST_ASSIGNED', 'ADMIN_REQUEST_APPROVED', 'ADMIN_REQUEST_REJECTED', 'ADMIN_REQUEST_COMPLETED',
  'LOW_OFFICE_STOCK', 'MAINTENANCE_DUE', 'MAINTENANCE_OVERDUE', 'VEHICLE_REGISTRATION_EXPIRING', 'VEHICLE_INSURANCE_EXPIRING',
  'ADMIN_CONTRACT_EXPIRING', 'ADMIN_DOCUMENT_EXPIRING', 'ADMIN_COMPLIANCE_EXPIRING',
  'TRAVEL_APPROVAL_NEEDED', 'VISITOR_EXPECTED', 'MEETING_REMINDER', 'EVENT_REMINDER', 'WORKSPACE_ASSIGNED', 'OFFICE_RELOCATION',
  'PRODUCTION_TASK_ASSIGNED', 'PRODUCTION_TASK_OVERDUE', 'PRODUCTION_TASK_AT_RISK',
  'PRODUCTION_REVIEW_REQUESTED', 'PRODUCTION_REVIEW_DECIDED', 'PRODUCTION_VERSION_SUBMITTED',
  'PRODUCTION_MILESTONE_DUE', 'PRODUCTION_MILESTONE_OVERDUE',
  'PRODUCTION_DELIVERABLE_DUE', 'PRODUCTION_DELIVERABLE_OVERDUE'
]));

-- ---------------------------------------------------------------------
-- Risk sweep: recomputes production_tasks.risk_status and
-- production_shots.risk_status from due_date vs today. A shot's risk
-- rolls up from its own open tasks -- LATE if any open task is overdue,
-- AT_RISK if any is due within 2 days, else ON_TRACK.
-- ---------------------------------------------------------------------
create or replace function public.recalculate_production_risk(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.production_tasks
  set risk_status = case
    when status in ('COMPLETED', 'APPROVED') then 'ON_TRACK'
    when due_date is null then 'ON_TRACK'
    when due_date < current_date then 'LATE'
    when due_date <= current_date + 2 then 'AT_RISK'
    else 'ON_TRACK'
  end
  where company_id = p_company_id;

  update public.production_shots s
  set risk_status = coalesce((
    select case
      when bool_or(t.risk_status = 'LATE') then 'LATE'
      when bool_or(t.risk_status = 'AT_RISK') then 'AT_RISK'
      else 'ON_TRACK'
    end
    from public.production_tasks t
    where t.shot_id = s.id and t.status not in ('COMPLETED', 'APPROVED')
  ), 'ON_TRACK')
  where s.company_id = p_company_id;
end;
$$;

grant execute on function public.recalculate_production_risk(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Notification sweep, same shape as generate_admin_notifications(): scan
-- time-based conditions, insert with dedup via the existing unique
-- (company_id, type, resource_type, resource_id) constraint.
-- ---------------------------------------------------------------------
create or replace function public.generate_production_notifications(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'PRODUCTION.DASHBOARD.VIEW') and not public.is_platform_superadmin() then
    raise exception 'Not permitted';
  end if;

  insert into public.notifications (company_id, type, resource_type, resource_id, title, message, user_id)
  select p_company_id, 'PRODUCTION_TASK_OVERDUE', 'production_task', t.id,
    'Task overdue: ' || t.name,
    t.task_code || ' was due ' || t.due_date::text,
    e.user_id
  from public.production_tasks t
  join public.employees e on e.id = t.assigned_to
  where t.company_id = p_company_id and t.due_date < current_date
    and t.status not in ('COMPLETED', 'APPROVED') and e.user_id is not null
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, resource_type, resource_id, title, message, user_id)
  select p_company_id, 'PRODUCTION_MILESTONE_OVERDUE', 'production_milestone', m.id,
    'Milestone overdue: ' || m.name,
    m.milestone_code || ' was due ' || m.due_date::text,
    pr.director_id
  from public.production_milestones m
  join public.production_projects pr on pr.id = m.project_id
  join public.employees e on e.id = pr.director_id
  where m.company_id = p_company_id and m.due_date < current_date
    and m.status not in ('COMPLETED', 'CANCELLED') and e.user_id is not null
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  insert into public.notifications (company_id, type, resource_type, resource_id, title, message, user_id)
  select p_company_id, 'PRODUCTION_DELIVERABLE_OVERDUE', 'production_deliverable', d.id,
    'Deliverable overdue: ' || d.name,
    d.deliverable_code || ' was due ' || d.due_date::text,
    pr.producer_id
  from public.production_deliverables d
  join public.production_projects pr on pr.id = d.project_id
  join public.employees e on e.id = pr.producer_id
  where d.company_id = p_company_id and d.due_date < current_date
    and d.status not in ('DELIVERED') and e.user_id is not null
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.generate_production_notifications(uuid) to authenticated;
