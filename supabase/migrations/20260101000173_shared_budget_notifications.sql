-- =========================================================================
-- BUDGET & PROCUREMENT ARCHITECTURE CORRECTION -- Part 3: notifications.
--
-- Widens the cumulative notifications.type constraint with the five new
-- budget-workflow types, following the app's own hand-maintained-cumulative
-- convention. Two are always Finance's concern (BUDGET_SUBMITTED,
-- BUDGET_INCREASE_REQUESTED); the other three (BUDGET_RETURNED,
-- BUDGET_APPROVED, BUDGET_REJECTED) are addressed to a specific budget
-- owner via notifications.user_id -- a column that has existed since
-- Phase 2 but has never actually been used for per-user targeting until
-- now. Making that work correctly regardless of which module bucket the
-- notification lands in requires two small, general, backward-compatible
-- widenings on top of the notifications RLS shipped in 20260101000166:
--   1. before_insert_notification() only auto-derives `module` when the
--      caller left it null -- so a caller can address a notification
--      precisely without the trigger overwriting that choice.
--   2. Each RLS branch gains "OR user_id = auth.uid()" -- a notification
--      addressed to a specific person is always visible to them, while
--      broadcast (user_id is null) notifications keep requiring that
--      module's permission exactly as before.
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
  'PRODUCTION_DELIVERABLE_DUE', 'PRODUCTION_DELIVERABLE_OVERDUE',
  'BUDGET_SUBMITTED', 'BUDGET_RETURNED', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 'BUDGET_INCREASE_REQUESTED'
]));

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
      'FINANCIAL_PERIOD_CLOSING', 'BANK_RECONCILIATION_REQUIRED',
      'BUDGET_SUBMITTED', 'BUDGET_RETURNED', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 'BUDGET_INCREASE_REQUESTED'
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

-- Respect an explicit module the caller already set (e.g. the budget RPCs
-- always set module = 'FINANCE' themselves); only auto-derive when absent.
create or replace function public.before_insert_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.module is null then
    new.module := public.notification_module_for_type(new.type);
  end if;
  return new;
end;
$$;

-- Targeted notifications (user_id set) are always visible to their
-- target, regardless of which module bucket they landed in -- broadcast
-- notifications (user_id null) keep requiring that module's permission
-- exactly as before. This is what lets a budget owner in ANY department
-- see their own BUDGET_APPROVED/RETURNED/REJECTED notification without
-- needing FINANCE.NOTIFICATIONS.VIEW.
drop policy "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (
    public.has_company_access(company_id)
    and (
      user_id = auth.uid()
      or (
        user_id is null
        and case module
          when 'IT' then public.has_module_enabled(company_id, 'INVENTORY') and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
          when 'HR' then public.has_module_enabled(company_id, 'HR') and public.has_permission(company_id, 'HR.NOTIFICATIONS.VIEW')
          when 'FINANCE' then public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.NOTIFICATIONS.VIEW')
          when 'ADMIN' then public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.NOTIFICATIONS.VIEW')
          when 'PRODUCTION' then public.has_module_enabled(company_id, 'PRODUCTION') and public.has_permission(company_id, 'PRODUCTION.NOTIFICATIONS.VIEW')
          else false
        end
      )
    )
  );

drop policy "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (
    public.has_company_access(company_id)
    and (
      user_id = auth.uid()
      or (
        user_id is null
        and case module
          when 'IT' then public.has_module_enabled(company_id, 'INVENTORY') and public.has_permission(company_id, 'IT.NOTIFICATIONS.VIEW')
          when 'HR' then public.has_module_enabled(company_id, 'HR') and public.has_permission(company_id, 'HR.NOTIFICATIONS.VIEW')
          when 'FINANCE' then public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.NOTIFICATIONS.VIEW')
          when 'ADMIN' then public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.NOTIFICATIONS.VIEW')
          when 'PRODUCTION' then public.has_module_enabled(company_id, 'PRODUCTION') and public.has_permission(company_id, 'PRODUCTION.NOTIFICATIONS.VIEW')
          else false
        end
      )
    )
  );
