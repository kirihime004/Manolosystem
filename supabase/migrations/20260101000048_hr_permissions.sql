-- =========================================================================
-- PHASE 4: HR permission catalog. Mirrors the IT.* / ADMIN.* pattern
-- established in Phase 1-3 -- KEY = MODULE.RESOURCE.ACTION.
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('HR.DASHBOARD.VIEW', 'HR', 'DASHBOARD', 'VIEW', 'View the HR dashboard'),

  ('HR.EMPLOYEES.VIEW',           'HR', 'EMPLOYEES', 'VIEW',           'View employee directory and profiles'),
  ('HR.EMPLOYEES.CREATE',         'HR', 'EMPLOYEES', 'CREATE',         'Create a new employee record'),
  ('HR.EMPLOYEES.UPDATE',         'HR', 'EMPLOYEES', 'UPDATE',         'Edit employee and employment fields'),
  ('HR.EMPLOYEES.DELETE',         'HR', 'EMPLOYEES', 'DELETE',         'Delete an employee record'),
  ('HR.EMPLOYEES.ARCHIVE',        'HR', 'EMPLOYEES', 'ARCHIVE',        'Deactivate/reactivate an employee'),
  ('HR.EMPLOYEES.VIEW_SENSITIVE', 'HR', 'EMPLOYEES', 'VIEW_SENSITIVE', 'View private HR notes and personal documents'),
  ('HR.EMPLOYEES.VIEW_SALARY',    'HR', 'EMPLOYEES', 'VIEW_SALARY',    'View compensation and salary history'),

  ('HR.DEPARTMENTS.VIEW',   'HR', 'DEPARTMENTS', 'VIEW',   'View departments'),
  ('HR.DEPARTMENTS.CREATE', 'HR', 'DEPARTMENTS', 'CREATE', 'Create a department'),
  ('HR.DEPARTMENTS.UPDATE', 'HR', 'DEPARTMENTS', 'UPDATE', 'Edit a department'),
  ('HR.DEPARTMENTS.DELETE', 'HR', 'DEPARTMENTS', 'DELETE', 'Delete a department'),

  ('HR.POSITIONS.VIEW',   'HR', 'POSITIONS', 'VIEW',   'View positions'),
  ('HR.POSITIONS.CREATE', 'HR', 'POSITIONS', 'CREATE', 'Create a position'),
  ('HR.POSITIONS.UPDATE', 'HR', 'POSITIONS', 'UPDATE', 'Edit a position'),
  ('HR.POSITIONS.DELETE', 'HR', 'POSITIONS', 'DELETE', 'Delete a position'),

  ('HR.ATTENDANCE.VIEW',    'HR', 'ATTENDANCE', 'VIEW',    'View attendance records'),
  ('HR.ATTENDANCE.CREATE',  'HR', 'ATTENDANCE', 'CREATE',  'Record attendance manually'),
  ('HR.ATTENDANCE.UPDATE',  'HR', 'ATTENDANCE', 'UPDATE',  'Edit an attendance record'),
  ('HR.ATTENDANCE.APPROVE', 'HR', 'ATTENDANCE', 'APPROVE', 'Approve attendance correction requests'),

  ('HR.LEAVE.VIEW',    'HR', 'LEAVE', 'VIEW',    'View leave requests and balances'),
  ('HR.LEAVE.CREATE',  'HR', 'LEAVE', 'CREATE',  'Submit a leave request'),
  ('HR.LEAVE.UPDATE',  'HR', 'LEAVE', 'UPDATE',  'Edit a draft leave request'),
  ('HR.LEAVE.APPROVE', 'HR', 'LEAVE', 'APPROVE', 'Approve a leave request'),
  ('HR.LEAVE.REJECT',  'HR', 'LEAVE', 'REJECT',  'Reject a leave request'),

  ('HR.OVERTIME.VIEW',    'HR', 'OVERTIME', 'VIEW',    'View overtime requests'),
  ('HR.OVERTIME.CREATE',  'HR', 'OVERTIME', 'CREATE',  'Submit an overtime request'),
  ('HR.OVERTIME.APPROVE', 'HR', 'OVERTIME', 'APPROVE', 'Approve or reject an overtime request'),

  ('HR.TIMESHEETS.VIEW',    'HR', 'TIMESHEETS', 'VIEW',    'View timesheets'),
  ('HR.TIMESHEETS.CREATE',  'HR', 'TIMESHEETS', 'CREATE',  'Record a timesheet entry'),
  ('HR.TIMESHEETS.APPROVE', 'HR', 'TIMESHEETS', 'APPROVE', 'Approve timesheet entries'),

  ('HR.REQUESTS.VIEW',    'HR', 'REQUESTS', 'VIEW',    'View HR requests'),
  ('HR.REQUESTS.CREATE',  'HR', 'REQUESTS', 'CREATE',  'Create an HR request'),
  ('HR.REQUESTS.UPDATE',  'HR', 'REQUESTS', 'UPDATE',  'Edit a draft HR request'),
  ('HR.REQUESTS.APPROVE', 'HR', 'REQUESTS', 'APPROVE', 'Approve/complete an HR request'),
  ('HR.REQUESTS.REJECT',  'HR', 'REQUESTS', 'REJECT',  'Reject an HR request'),

  ('HR.DOCUMENTS.VIEW',   'HR', 'DOCUMENTS', 'VIEW',   'View employee documents (metadata + signed download)'),
  ('HR.DOCUMENTS.CREATE', 'HR', 'DOCUMENTS', 'CREATE', 'Upload an employee document'),
  ('HR.DOCUMENTS.UPDATE', 'HR', 'DOCUMENTS', 'UPDATE', 'Edit document metadata'),
  ('HR.DOCUMENTS.DELETE', 'HR', 'DOCUMENTS', 'DELETE', 'Delete an employee document'),

  ('HR.CONTRACTS.VIEW',   'HR', 'CONTRACTS', 'VIEW',   'View employment contracts'),
  ('HR.CONTRACTS.CREATE', 'HR', 'CONTRACTS', 'CREATE', 'Create an employment contract'),
  ('HR.CONTRACTS.UPDATE', 'HR', 'CONTRACTS', 'UPDATE', 'Edit an employment contract'),
  ('HR.CONTRACTS.RENEW',  'HR', 'CONTRACTS', 'RENEW',  'Renew an employment contract'),

  ('HR.BENEFITS.VIEW',   'HR', 'BENEFITS', 'VIEW',   'View employee benefits'),
  ('HR.BENEFITS.CREATE', 'HR', 'BENEFITS', 'CREATE', 'Enroll an employee benefit'),
  ('HR.BENEFITS.UPDATE', 'HR', 'BENEFITS', 'UPDATE', 'Edit an employee benefit'),

  ('HR.DEDUCTIONS.VIEW',   'HR', 'DEDUCTIONS', 'VIEW',   'View employee deductions'),
  ('HR.DEDUCTIONS.CREATE', 'HR', 'DEDUCTIONS', 'CREATE', 'Create an employee deduction'),
  ('HR.DEDUCTIONS.UPDATE', 'HR', 'DEDUCTIONS', 'UPDATE', 'Edit an employee deduction'),

  ('HR.COMPENSATION.VIEW',   'HR', 'COMPENSATION', 'VIEW',   'View compensation records'),
  ('HR.COMPENSATION.CREATE', 'HR', 'COMPENSATION', 'CREATE', 'Record a new compensation entry'),
  ('HR.COMPENSATION.UPDATE', 'HR', 'COMPENSATION', 'UPDATE', 'Edit a draft compensation entry'),

  ('HR.PAYROLL.VIEW',    'HR', 'PAYROLL', 'VIEW',    'View payroll periods and preparation data'),
  ('HR.PAYROLL.CREATE',  'HR', 'PAYROLL', 'CREATE',  'Create a payroll period'),
  ('HR.PAYROLL.UPDATE',  'HR', 'PAYROLL', 'UPDATE',  'Edit a payroll period'),
  ('HR.PAYROLL.APPROVE', 'HR', 'PAYROLL', 'APPROVE', 'Approve a payroll period'),

  ('HR.REPORTS.VIEW',   'HR', 'REPORTS', 'VIEW',   'View HR reports'),
  ('HR.REPORTS.EXPORT', 'HR', 'REPORTS', 'EXPORT', 'Export HR reports'),
  ('HR.REPORTS.PRINT',  'HR', 'REPORTS', 'PRINT',  'Print HR reports'),

  ('HR.SETTINGS.MANAGE', 'HR', 'SETTINGS', 'MANAGE', 'Configure employment types/statuses, leave types, schedules, holidays');

-- ---------------------------------------------------------------------
-- Backfill: grant the full HR.* catalog to each existing company's
-- system Admin and HR roles, same pattern as migrations 028/040.
-- ---------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Admin' and p.key like 'HR.%'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'HR'
  and p.key not in ('HR.EMPLOYEES.DELETE', 'HR.PAYROLL.APPROVE')
on conflict (role_id, permission_id) do nothing;

-- Every employee-level role gets the self-service surface: their own
-- profile, leave, overtime, timesheets, and requests. RLS still scopes
-- what "own" means -- this only grants the verbs.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name in ('IT', 'Accountant', 'Artist', 'Director', 'Employee')
  and p.key in (
    'HR.DASHBOARD.VIEW', 'HR.LEAVE.VIEW', 'HR.LEAVE.CREATE',
    'HR.OVERTIME.VIEW', 'HR.OVERTIME.CREATE',
    'HR.TIMESHEETS.VIEW', 'HR.TIMESHEETS.CREATE',
    'HR.REQUESTS.VIEW', 'HR.REQUESTS.CREATE',
    'HR.DOCUMENTS.VIEW', 'HR.CONTRACTS.VIEW', 'HR.BENEFITS.VIEW'
  )
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------
-- Same defaults for every company created from now on.
-- ---------------------------------------------------------------------
create or replace function public.seed_company_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_admin uuid;
  v_role_it uuid;
  v_role_hr uuid;
  v_role_accountant uuid;
  v_role_artist uuid;
  v_role_director uuid;
  v_role_employee uuid;
begin
  insert into public.company_modules (company_id, module_key, enabled)
  select new.id, m.module_key, false
  from unnest(enum_range(null::public.module_key)) as m(module_key);

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Admin', 'Full administrative access to this company', true)
  returning id into v_role_admin;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'IT', 'IT staff: manage and resolve tickets and inventory', true)
  returning id into v_role_it;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'HR', 'Human resources staff', true)
  returning id into v_role_hr;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Accountant', 'Finance staff', true)
  returning id into v_role_accountant;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Artist', 'Production artist', true)
  returning id into v_role_artist;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Director', 'Production director', true)
  returning id into v_role_director;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Employee', 'Standard employee access', true)
  returning id into v_role_employee;

  -- Admin: every permission that exists today.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin, p.id from public.permissions p;

  -- IT: full ticket lifecycle (except deleting tickets) plus the day-to-day
  -- inventory operations. Disposal, deletion, and credential
  -- create/update/delete/reveal stay Admin-only by default.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_it, p.id from public.permissions p
  where p.key in (
    'IT.TICKETS.VIEW', 'IT.TICKETS.CREATE', 'IT.TICKETS.UPDATE',
    'IT.TICKETS.ASSIGN', 'IT.TICKETS.COMMENT', 'IT.TICKETS.RESOLVE', 'IT.TICKETS.CLOSE',
    'IT.INVENTORY.VIEW', 'IT.INVENTORY.CREATE', 'IT.INVENTORY.UPDATE', 'IT.INVENTORY.ASSIGN',
    'IT.INVENTORY.REPAIR', 'IT.INVENTORY.EXPORT', 'IT.INVENTORY.PRINT',
    'IT.IP.VIEW', 'IT.IP.UPDATE',
    'IT.CREDENTIALS.VIEW',
    'IT.NOTIFICATIONS.VIEW'
  );

  -- HR: the whole HR.* surface except deleting employees and approving payroll.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_hr, p.id from public.permissions p
  where p.key like 'HR.%' and p.key not in ('HR.EMPLOYEES.DELETE', 'HR.PAYROLL.APPROVE');

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director)) as r(id)
  cross join public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT');

  -- Every role below Admin: baseline employee self-service.
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_it), (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director), (v_role_employee)) as r(id)
  cross join public.permissions p
  where p.key in (
    'HR.DASHBOARD.VIEW', 'HR.LEAVE.VIEW', 'HR.LEAVE.CREATE',
    'HR.OVERTIME.VIEW', 'HR.OVERTIME.CREATE',
    'HR.TIMESHEETS.VIEW', 'HR.TIMESHEETS.CREATE',
    'HR.REQUESTS.VIEW', 'HR.REQUESTS.CREATE',
    'HR.DOCUMENTS.VIEW', 'HR.CONTRACTS.VIEW', 'HR.BENEFITS.VIEW'
  );

  insert into public.role_permissions (role_id, permission_id)
  select v_role_employee, p.id from public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT');

  return new;
end;
$$;
