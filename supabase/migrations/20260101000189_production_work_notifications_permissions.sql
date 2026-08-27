-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 6:
-- notifications + permissions. Widens the hand-maintained cumulative
-- notifications.type constraint (same convention every phase has used)
-- and notification_module_for_type(); adds the exact permission keys the
-- spec names (PRODUCTION.RATES.*) plus PRODUCTION.WORK.* for the
-- submit/approve/adjust workflow.
-- =========================================================================

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
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
  'BUDGET_SUBMITTED', 'BUDGET_RETURNED', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 'BUDGET_INCREASE_REQUESTED',
  'PRODUCTION_WORK_SUBMITTED', 'PRODUCTION_WORK_APPROVED', 'PRODUCTION_WORK_REJECTED',
  'PRODUCTION_WORK_CHANGES_REQUIRED', 'PRODUCTION_WORK_SENT_TO_PAYROLL', 'PRODUCTION_WORK_PAID'
));

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
      'PRODUCTION_DELIVERABLE_DUE', 'PRODUCTION_DELIVERABLE_OVERDUE',
      'PRODUCTION_WORK_SUBMITTED', 'PRODUCTION_WORK_APPROVED', 'PRODUCTION_WORK_REJECTED',
      'PRODUCTION_WORK_CHANGES_REQUIRED', 'PRODUCTION_WORK_SENT_TO_PAYROLL', 'PRODUCTION_WORK_PAID'
    ) then 'PRODUCTION'::public.module_key
    else 'IT'::public.module_key
  end;
$$;

-- ---------------------------------------------------------------------
-- Permissions -- exactly as named in the spec for rate cards, plus a
-- WORK family for the submit/approve/adjust workflow.
-- ---------------------------------------------------------------------
insert into public.permissions (key, module_key, resource, action, description) values
  ('PRODUCTION.RATES.VIEW', 'PRODUCTION', 'RATES', 'VIEW', 'View production rate cards'),
  ('PRODUCTION.RATES.CREATE', 'PRODUCTION', 'RATES', 'CREATE', 'Create production rate cards and units'),
  ('PRODUCTION.RATES.UPDATE', 'PRODUCTION', 'RATES', 'UPDATE', 'Edit production rate cards and units'),
  ('PRODUCTION.RATES.DEACTIVATE', 'PRODUCTION', 'RATES', 'DEACTIVATE', 'Deactivate a production rate card'),
  ('PRODUCTION.RATES.VIEW_HISTORY', 'PRODUCTION', 'RATES', 'VIEW_HISTORY', 'View a rate card''s full change history'),
  ('PRODUCTION.WORK.SUBMIT', 'PRODUCTION', 'WORK', 'SUBMIT', 'Submit completed production work for payment approval'),
  ('PRODUCTION.WORK.VIEW_OWN', 'PRODUCTION', 'WORK', 'VIEW_OWN', 'View your own approved production earnings'),
  ('PRODUCTION.WORK.VIEW_ALL', 'PRODUCTION', 'WORK', 'VIEW_ALL', 'View every artist''s approved production earnings'),
  ('PRODUCTION.WORK.APPROVE', 'PRODUCTION', 'WORK', 'APPROVE', 'Approve, reject, or request changes on submitted production work'),
  ('PRODUCTION.WORK.ADJUST', 'PRODUCTION', 'WORK', 'ADJUST', 'Create an audited adjustment on already-approved production work')
on conflict (key) do nothing;

-- Default grants: Admin gets everything via the existing unfiltered
-- wildcard in seed_company_defaults(). Director/Producer (Production's
-- full-access roles) already pick up PRODUCTION.RATES.*/WORK.* via their
-- existing `p.key like 'PRODUCTION.%'` wildcard grant -- no redefinition
-- of seed_company_defaults() needed. Artist gets SUBMIT + VIEW_OWN
-- explicitly (their existing grant list is a narrow allowlist, not a
-- wildcard). Accountant (Finance's full-access role) needs VIEW_ALL to
-- see production earnings company-wide via its existing
-- `p.key like 'FINANCE.%'` wildcard -- which does NOT match
-- `PRODUCTION.WORK.VIEW_ALL`, so it's granted explicitly below too.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Admin' and (p.key like 'PRODUCTION.RATES.%' or p.key like 'PRODUCTION.WORK.%')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name in ('Director', 'Producer') and (p.key like 'PRODUCTION.RATES.%' or p.key like 'PRODUCTION.WORK.%')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Artist' and p.key in ('PRODUCTION.WORK.SUBMIT', 'PRODUCTION.WORK.VIEW_OWN')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Accountant' and p.key = 'PRODUCTION.WORK.VIEW_ALL'
on conflict (role_id, permission_id) do nothing;
