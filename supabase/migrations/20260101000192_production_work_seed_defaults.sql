-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 9: close a
-- seed-defaults gap found while writing migration 189.
--
-- Migration 189 backfilled PRODUCTION.WORK.SUBMIT/VIEW_OWN onto the
-- Artist role of EXISTING companies, but never touched
-- seed_company_defaults() itself. Director/Producer/Admin already pick up
-- every new PRODUCTION.% key automatically through their existing
-- wildcard grants in that function, so they were never at risk -- but
-- Artist's grant list is an explicit narrow allowlist (mirroring how HR/
-- Accountant/Admin Officer are wildcards but Artist and Employee are not),
-- so any company created after migration 189 and before this one would
-- silently NOT give its Artist role the ability to submit work at all.
--
-- Identical to the 175 version except the Artist role's explicit list
-- gains 'PRODUCTION.WORK.SUBMIT' and 'PRODUCTION.WORK.VIEW_OWN'. No other
-- change.
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
