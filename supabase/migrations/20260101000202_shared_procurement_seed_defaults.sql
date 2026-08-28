-- =========================================================================
-- SHARE PROCUREMENT ACROSS HR, FINANCE, ADMINISTRATION, AND PRODUCTION --
-- Part 5: seed_company_defaults() + seed_approval_policies() + backfill.
--
-- Two independent fixes bundled here:
--
-- 1. A real, pre-existing regression, found while auditing this: the
--    ORIGINAL migration 040 granted the IT system role
--    IT.PROCUREMENT.VIEW/CREATE/UPDATE/SUBMIT/CREATE_PO/RECEIVE/EXPORT/
--    PRINT + IT.SUPPLIERS.VIEW/CREATE/UPDATE by default -- but every
--    subsequent full redefinition of seed_company_defaults() (048/072/
--    100/134/157/175/192) silently dropped it and never restored it, the
--    same bug class migration 175 already fixed once for IT.BUDGET.VIEW.
--    So no company created after migration 048 has given its IT role ANY
--    procurement/supplier permission by default. Restored here, using
--    the exact original grant set (DELETE/APPROVE/APPROVE_PO/REJECT stay
--    Admin-only, matching Budget's "sensitive actions stay Admin-only"
--    convention).
--
-- 2. HR/Accountant/Administrative Officer/Director+Producer need NO
--    explicit list edit here: those four roles are already granted
--    through wildcards (`p.key like 'HR.%'`, `'FINANCE.%'`,
--    `'ADMIN.%' and resource not in (...)`, `'PRODUCTION.%'`), so their
--    own department's new <DEPT>.PROCUREMENT.*/<DEPT>.SUPPLIERS.* keys
--    (inserted in migration 199) arrive automatically for every NEW
--    company created after this migration. Only EXISTING companies need
--    a backfill (below) -- wildcards only apply at seed-trigger time, not
--    retroactively.
-- =========================================================================
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
  v_role_admin_officer uuid;
  v_role_producer uuid;
  v_role_supervisor uuid;
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

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Administrative Officer', 'Administration department staff: facilities, requests, assets, travel, and office operations', true)
  returning id into v_role_admin_officer;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Producer', 'Production producer: schedules, budgets, and cross-department coordination', true)
  returning id into v_role_producer;

  insert into public.roles (company_id, name, description, is_system)
  values (new.id, 'Supervisor', 'Department supervisor: reviews and task oversight for their team', true)
  returning id into v_role_supervisor;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_it, p.id from public.permissions p
  where p.key in (
    'IT.TICKETS.VIEW', 'IT.TICKETS.CREATE', 'IT.TICKETS.UPDATE',
    'IT.TICKETS.ASSIGN', 'IT.TICKETS.COMMENT', 'IT.TICKETS.RESOLVE', 'IT.TICKETS.CLOSE',
    'IT.INVENTORY.VIEW', 'IT.INVENTORY.CREATE', 'IT.INVENTORY.UPDATE', 'IT.INVENTORY.ASSIGN',
    'IT.INVENTORY.REPAIR', 'IT.INVENTORY.EXPORT', 'IT.INVENTORY.PRINT',
    'IT.IP.VIEW', 'IT.IP.UPDATE',
    'IT.CREDENTIALS.VIEW',
    'IT.NOTIFICATIONS.VIEW',
    'IT.BUDGET.VIEW', 'IT.BUDGET.CREATE', 'IT.BUDGET.UPDATE',
    'IT.PROCUREMENT.VIEW', 'IT.PROCUREMENT.CREATE', 'IT.PROCUREMENT.UPDATE', 'IT.PROCUREMENT.SUBMIT',
    'IT.PROCUREMENT.CREATE_PO', 'IT.PROCUREMENT.RECEIVE', 'IT.PROCUREMENT.EXPORT', 'IT.PROCUREMENT.PRINT',
    'IT.SUPPLIERS.VIEW', 'IT.SUPPLIERS.CREATE', 'IT.SUPPLIERS.UPDATE',
    'AI.ASSISTANT.VIEW', 'AI.IT_ANALYTICS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_hr, p.id from public.permissions p
  where (p.key like 'HR.%' and p.key not in ('HR.EMPLOYEES.DELETE', 'HR.PAYROLL.APPROVE'))
     or p.key in ('AI.ASSISTANT.VIEW', 'AI.HR_ANALYTICS.VIEW')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_accountant, p.id from public.permissions p
  where p.key like 'FINANCE.%' or p.key in ('AI.ASSISTANT.VIEW', 'AI.FINANCE_ANALYTICS.VIEW', 'BUDGET.FINANCE_APPROVE')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin_officer, p.id from public.permissions p
  where (p.key like 'ADMIN.%' and p.resource not in (
    'USERS', 'ROLES', 'DEPARTMENTS', 'IT_CATEGORIES', 'COMPANY_SETTINGS', 'AUDIT'
  )) or p.key in ('AI.ASSISTANT.VIEW', 'AI.ADMIN_ANALYTICS.VIEW')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_director), (v_role_producer)) as r(id)
  cross join public.permissions p
  where p.key like 'PRODUCTION.%' or p.key in ('AI.ASSISTANT.VIEW', 'AI.PRODUCTION_ANALYTICS.VIEW')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_supervisor, p.id from public.permissions p
  where p.key in (
    'PRODUCTION.DASHBOARD.VIEW',
    'PRODUCTION.PROJECTS.VIEW',
    'PRODUCTION.SHOWS.VIEW', 'PRODUCTION.EPISODES.VIEW', 'PRODUCTION.SEQUENCES.VIEW',
    'PRODUCTION.SHOTS.VIEW', 'PRODUCTION.SHOTS.UPDATE',
    'PRODUCTION.ASSETS.VIEW',
    'PRODUCTION.TASKS.VIEW', 'PRODUCTION.TASKS.CREATE', 'PRODUCTION.TASKS.UPDATE', 'PRODUCTION.TASKS.ASSIGN',
    'PRODUCTION.DEPENDENCIES.MANAGE',
    'PRODUCTION.MILESTONES.VIEW',
    'PRODUCTION.SCHEDULE.VIEW',
    'PRODUCTION.VERSIONS.VIEW', 'PRODUCTION.VERSIONS.CREATE',
    'PRODUCTION.REVIEWS.VIEW', 'PRODUCTION.REVIEWS.CREATE', 'PRODUCTION.REVIEWS.DECIDE',
    'PRODUCTION.NOTES.VIEW', 'PRODUCTION.NOTES.CREATE', 'PRODUCTION.NOTES.RESOLVE',
    'PRODUCTION.DELIVERABLES.VIEW',
    'PRODUCTION.FILES.UPLOAD',
    'PRODUCTION.RESOURCES.VIEW',
    'PRODUCTION.REPORTS.VIEW',
    'AI.ASSISTANT.VIEW', 'AI.PRODUCTION_ANALYTICS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_artist, p.id from public.permissions p
  where p.key in (
    'PRODUCTION.DASHBOARD.VIEW',
    'PRODUCTION.PROJECTS.VIEW',
    'PRODUCTION.SHOWS.VIEW', 'PRODUCTION.EPISODES.VIEW', 'PRODUCTION.SEQUENCES.VIEW',
    'PRODUCTION.SHOTS.VIEW',
    'PRODUCTION.ASSETS.VIEW',
    'PRODUCTION.TASKS.VIEW',
    'PRODUCTION.VERSIONS.VIEW', 'PRODUCTION.VERSIONS.CREATE',
    'PRODUCTION.REVIEWS.VIEW',
    'PRODUCTION.NOTES.VIEW', 'PRODUCTION.NOTES.CREATE',
    'PRODUCTION.DELIVERABLES.VIEW',
    'PRODUCTION.FILES.UPLOAD',
    'PRODUCTION.WORK.SUBMIT', 'PRODUCTION.WORK.VIEW_OWN',
    'AI.ASSISTANT.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director)) as r(id)
  cross join public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_it), (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director), (v_role_employee), (v_role_admin_officer), (v_role_producer), (v_role_supervisor)) as r(id)
  cross join public.permissions p
  where p.key in (
    'HR.DASHBOARD.VIEW', 'HR.LEAVE.VIEW', 'HR.LEAVE.CREATE',
    'HR.OVERTIME.VIEW', 'HR.OVERTIME.CREATE',
    'HR.TIMESHEETS.VIEW', 'HR.TIMESHEETS.CREATE',
    'HR.REQUESTS.VIEW', 'HR.REQUESTS.CREATE',
    'HR.DOCUMENTS.VIEW', 'HR.CONTRACTS.VIEW', 'HR.BENEFITS.VIEW',
    'FINANCE.EXPENSES.VIEW', 'FINANCE.EXPENSES.CREATE',
    'ADMIN.DASHBOARD.VIEW', 'ADMIN.REQUESTS.VIEW', 'ADMIN.REQUESTS.CREATE',
    'ADMIN.ROOMS.VIEW', 'ADMIN.ROOMS.BOOK', 'ADMIN.SUPPLIES.VIEW',
    'ADMIN.TRAVEL.VIEW', 'ADMIN.TRAVEL.CREATE',
    'ADMIN.MEETINGS.VIEW', 'ADMIN.MEETINGS.CREATE',
    'ADMIN.ANNOUNCEMENTS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_employee, p.id from public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT', 'AI.ASSISTANT.VIEW')
  on conflict (role_id, permission_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Backfill for existing companies.
-- ---------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'IT' and p.key in (
  'IT.PROCUREMENT.VIEW', 'IT.PROCUREMENT.CREATE', 'IT.PROCUREMENT.UPDATE', 'IT.PROCUREMENT.SUBMIT',
  'IT.PROCUREMENT.CREATE_PO', 'IT.PROCUREMENT.RECEIVE', 'IT.PROCUREMENT.EXPORT', 'IT.PROCUREMENT.PRINT',
  'IT.SUPPLIERS.VIEW', 'IT.SUPPLIERS.CREATE', 'IT.SUPPLIERS.UPDATE'
)
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'HR' and (p.key like 'HR.PROCUREMENT.%' or p.key like 'HR.SUPPLIERS.%')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Accountant' and (p.key like 'FINANCE.PROCUREMENT.%' or p.key like 'FINANCE.SUPPLIERS.%')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Administrative Officer' and (p.key like 'ADMIN.PROCUREMENT.%' or p.key like 'ADMIN.SUPPLIERS.%')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name in ('Director', 'Producer') and (p.key like 'PRODUCTION.PROCUREMENT.%' or p.key like 'PRODUCTION.SUPPLIERS.%')
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------
-- seed_approval_policies(): the PURCHASE_REQUEST/PURCHASE_ORDER rows now
-- carry a module_key and are seeded for all 5 departments (was: one
-- catch-all IT row each). LEAVE_REQUEST/OVERTIME_REQUEST/PRODUCTION_WORK
-- are untouched -- their module_key stays null (matches everyone, same
-- as before).
-- ---------------------------------------------------------------------
create or replace function public.seed_approval_policies()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.approval_policies (company_id, module, module_key, minimum_amount, maximum_amount, required_permission, approval_sequence)
  values
    (new.id, 'PURCHASE_REQUEST', 'IT', 0, null, 'IT.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_REQUEST', 'HR', 0, null, 'HR.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_REQUEST', 'FINANCE', 0, null, 'FINANCE.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_REQUEST', 'ADMIN', 0, null, 'ADMIN.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_REQUEST', 'PRODUCTION', 0, null, 'PRODUCTION.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_ORDER', 'IT', 0, null, 'IT.PROCUREMENT.APPROVE_PO', 1),
    (new.id, 'PURCHASE_ORDER', 'HR', 0, null, 'HR.PROCUREMENT.APPROVE_PO', 1),
    (new.id, 'PURCHASE_ORDER', 'FINANCE', 0, null, 'FINANCE.PROCUREMENT.APPROVE_PO', 1),
    (new.id, 'PURCHASE_ORDER', 'ADMIN', 0, null, 'ADMIN.PROCUREMENT.APPROVE_PO', 1),
    (new.id, 'PURCHASE_ORDER', 'PRODUCTION', 0, null, 'PRODUCTION.PROCUREMENT.APPROVE_PO', 1),
    (new.id, 'LEAVE_REQUEST', null, 0, null, 'HR.LEAVE.APPROVE', 1),
    (new.id, 'OVERTIME_REQUEST', null, 0, null, 'HR.OVERTIME.APPROVE', 1),
    (new.id, 'PRODUCTION_WORK', null, 0, null, 'PRODUCTION.WORK.APPROVE', 1);
  return new;
end;
$$;
