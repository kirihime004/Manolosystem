-- =========================================================================
-- Fix: notifications RLS has gated ALL notifications (HR, Finance, Admin,
-- Production included) behind has_module_enabled('INVENTORY') +
-- 'IT.NOTIFICATIONS.VIEW' since the table was first created for IT/Inventory
-- alone (20260101000024/27/32). Every later phase kept inserting its own
-- notification types (procurement, HR, finance, admin, production) into the
-- same shared table without ever widening who could see them -- so an HR
-- manager approving leave, a Finance user with an overdue bill, or a
-- Production lead with an at-risk task never saw a notification anywhere.
-- The AI alerts migration (20260101000160) even called this out explicitly
-- and worked around it with a brand-new ai_alerts table rather than fixing
-- the root cause. This migration fixes the root cause instead.
--
-- Approach: add a `module` column derived from `type` (auto-populated via
-- trigger, so none of the six existing generate_*_notifications() functions
-- need to be touched), then scope RLS per-module using each module's own
-- notifications-view permission. IT/Inventory/Procurement keep the exact
-- existing gate unchanged; HR/Finance/Admin/Production get their own new
-- permission, mirroring the shape of IT.NOTIFICATIONS.VIEW exactly.
-- =========================================================================

create or replace function public.notification_module_for_type(p_type text)
returns public.module_key
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_type in (
      'HARDWARE_NEARING_EOL', 'HARDWARE_OVER_EOL', 'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED',
      'SUBSCRIPTION_RENEWAL_DUE', 'SUBSCRIPTION_EXPIRED', 'IP_CONFLICT', 'ASSET_DEFECTIVE', 'REPAIR_OVERDUE',
      'PR_SUBMITTED', 'PR_APPROVED', 'PR_REJECTED', 'PO_AWAITING_APPROVAL', 'PO_APPROVED', 'PO_SENT_TO_SUPPLIER',
      'DELIVERY_OVERDUE', 'DELIVERY_PARTIAL', 'BUDGET_THRESHOLD', 'BUDGET_PERIOD_ENDING'
    ) then 'IT'::public.module_key
    when p_type in (
      'NEW_EMPLOYEE', 'ONBOARDING_TASK', 'OFFBOARDING_TASK', 'PROBATION_ENDING', 'CONTRACT_EXPIRING', 'DOCUMENT_EXPIRING',
      'LEAVE_SUBMITTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
      'ATTENDANCE_CORRECTION_SUBMITTED', 'ATTENDANCE_CORRECTION_APPROVED', 'ATTENDANCE_CORRECTION_REJECTED',
      'OVERTIME_SUBMITTED', 'OVERTIME_APPROVED', 'OVERTIME_REJECTED', 'PAYROLL_PENDING', 'EMPLOYEE_TERMINATED',
      'HR_REQUEST_SUBMITTED', 'HR_REQUEST_UNDER_REVIEW', 'HR_REQUEST_APPROVED', 'HR_REQUEST_REJECTED',
      'HR_REQUEST_COMPLETED', 'HR_REQUEST_CANCELLED'
    ) then 'HR'::public.module_key
    when p_type in (
      'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'EXPENSE_REJECTED', 'PAYMENT_COMPLETED', 'PAYROLL_APPROVED', 'PAYROLL_PAID',
      'INVOICE_DUE', 'INVOICE_OVERDUE', 'BILL_DUE', 'BILL_OVERDUE', 'TAX_DEADLINE',
      'FINANCIAL_PERIOD_CLOSING', 'BANK_RECONCILIATION_REQUIRED'
    ) then 'FINANCE'::public.module_key
    when p_type in (
      'ADMIN_REQUEST_SUBMITTED', 'ADMIN_REQUEST_ASSIGNED', 'ADMIN_REQUEST_APPROVED', 'ADMIN_REQUEST_REJECTED', 'ADMIN_REQUEST_COMPLETED',
      'LOW_OFFICE_STOCK', 'MAINTENANCE_DUE', 'MAINTENANCE_OVERDUE', 'VEHICLE_REGISTRATION_EXPIRING', 'VEHICLE_INSURANCE_EXPIRING',
      'ADMIN_CONTRACT_EXPIRING', 'ADMIN_DOCUMENT_EXPIRING', 'ADMIN_COMPLIANCE_EXPIRING',
      'TRAVEL_APPROVAL_NEEDED', 'VISITOR_EXPECTED', 'MEETING_REMINDER', 'EVENT_REMINDER', 'WORKSPACE_ASSIGNED', 'OFFICE_RELOCATION'
    ) then 'ADMIN'::public.module_key
    when p_type in (
      'PRODUCTION_TASK_ASSIGNED', 'PRODUCTION_TASK_OVERDUE', 'PRODUCTION_TASK_AT_RISK',
      'PRODUCTION_REVIEW_REQUESTED', 'PRODUCTION_REVIEW_DECIDED', 'PRODUCTION_VERSION_SUBMITTED',
      'PRODUCTION_MILESTONE_DUE', 'PRODUCTION_MILESTONE_OVERDUE',
      'PRODUCTION_DELIVERABLE_DUE', 'PRODUCTION_DELIVERABLE_OVERDUE'
    ) then 'PRODUCTION'::public.module_key
    else 'IT'::public.module_key
  end;
$$;

alter table public.notifications add column module public.module_key not null default 'IT';
update public.notifications set module = public.notification_module_for_type(type);

create or replace function public.before_insert_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.module := public.notification_module_for_type(new.type);
  return new;
end;
$$;

create trigger before_insert_notification_trigger
  before insert on public.notifications
  for each row execute function public.before_insert_notification();

-- ---------------------------------------------------------------------
-- New per-module notifications-view permissions, mirroring
-- IT.NOTIFICATIONS.VIEW exactly. HR.%, FINANCE.%, and PRODUCTION.% are
-- already granted wildcard-style to the HR/Accountant/Director/Producer
-- system roles in seed_company_defaults(), and ADMIN.% (excluding a
-- denylist that doesn't include NOTIFICATIONS) is already granted the
-- same way to Administrative Officer -- so these new keys reach the
-- right default roles for every company created from now on with no
-- further change to that function. Existing companies are backfilled
-- explicitly below, the same way every prior phase's new permission was
-- backfilled onto its module's existing system roles.
-- ---------------------------------------------------------------------
insert into public.permissions (key, module_key, resource, action, description) values
  ('HR.NOTIFICATIONS.VIEW', 'HR', 'NOTIFICATIONS', 'VIEW', 'View HR notifications'),
  ('FINANCE.NOTIFICATIONS.VIEW', 'FINANCE', 'NOTIFICATIONS', 'VIEW', 'View Finance notifications'),
  ('ADMIN.NOTIFICATIONS.VIEW', 'ADMIN', 'NOTIFICATIONS', 'VIEW', 'View Administration notifications'),
  ('PRODUCTION.NOTIFICATIONS.VIEW', 'PRODUCTION', 'NOTIFICATIONS', 'VIEW', 'View Production notifications')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Admin' and p.key in (
  'HR.NOTIFICATIONS.VIEW', 'FINANCE.NOTIFICATIONS.VIEW', 'ADMIN.NOTIFICATIONS.VIEW', 'PRODUCTION.NOTIFICATIONS.VIEW'
)
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'HR' and p.key = 'HR.NOTIFICATIONS.VIEW'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Accountant' and p.key = 'FINANCE.NOTIFICATIONS.VIEW'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Administrative Officer' and p.key = 'ADMIN.NOTIFICATIONS.VIEW'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name in ('Director', 'Producer', 'Supervisor') and p.key = 'PRODUCTION.NOTIFICATIONS.VIEW'
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------
-- RLS: each module's bucket checks its own module gate + its own
-- notifications-view permission. IT's bucket keeps the exact original
-- condition (has_module_enabled('INVENTORY') is deliberate -- Procurement
-- notification types have always lived in this bucket and Procurement's
-- own module gate was never separately required for them either).
-- ---------------------------------------------------------------------
drop policy "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (
    public.has_company_access(company_id)
    and (user_id is null or user_id = auth.uid())
    and case module
      when 'IT' then public.has_module_enabled(company_id, 'INVENTORY') and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
      when 'HR' then public.has_module_enabled(company_id, 'HR') and public.has_permission(company_id, 'HR.NOTIFICATIONS.VIEW')
      when 'FINANCE' then public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.NOTIFICATIONS.VIEW')
      when 'ADMIN' then public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.NOTIFICATIONS.VIEW')
      when 'PRODUCTION' then public.has_module_enabled(company_id, 'PRODUCTION') and public.has_permission(company_id, 'PRODUCTION.NOTIFICATIONS.VIEW')
      else false
    end
  );

drop policy "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (
    public.has_company_access(company_id)
    and (user_id is null or user_id = auth.uid())
    and case module
      when 'IT' then public.has_module_enabled(company_id, 'INVENTORY') and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
      when 'HR' then public.has_module_enabled(company_id, 'HR') and public.has_permission(company_id, 'HR.NOTIFICATIONS.VIEW')
      when 'FINANCE' then public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.NOTIFICATIONS.VIEW')
      when 'ADMIN' then public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.NOTIFICATIONS.VIEW')
      when 'PRODUCTION' then public.has_module_enabled(company_id, 'PRODUCTION') and public.has_permission(company_id, 'PRODUCTION.NOTIFICATIONS.VIEW')
      else false
    end
  );

-- ---------------------------------------------------------------------
-- recalculate_production_risk() had no access check at all (unlike its
-- sibling generate_production_notifications(), which requires
-- PRODUCTION.DASHBOARD.VIEW) -- now that it's being wired into a
-- frontend call path shared by every logged-in user, give it the same
-- minimal company-membership check the rest of this app's RPCs use.
-- ---------------------------------------------------------------------
create or replace function public.recalculate_production_risk(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_company_access(p_company_id) then
    raise exception 'Access denied';
  end if;

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
