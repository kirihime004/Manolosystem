-- =========================================================================
-- BUDGET & PROCUREMENT ARCHITECTURE CORRECTION -- Part 5: permissions.
--
-- New keys mirror the existing IT.BUDGET.* shape for the four other
-- departments. FINANCE.BUDGET.VIEW already exists (currently gates
-- cost/profit-center RLS, "View budget vs actual reporting") -- reused
-- rather than duplicated; CREATE/UPDATE/DELETE don't exist yet under that
-- resource, so adding them is a clean extension. BUDGET.FINANCE_APPROVE
-- and BUDGET.ADMIN_OVERRIDE are named exactly as specified -- the literal
-- key string doesn't need to match its module_key categorization column
-- (see IT.BUDGET.VIEW itself: key and module_key already diverge in
-- exactly this way for every existing permission).
--
-- Also fixes a real regression found while auditing this: the ORIGINAL
-- Phase 3 migration (20260101000040) granted IT.BUDGET.VIEW to the IT
-- role by default, but every subsequent full redefinition of
-- seed_company_defaults() (HR/Admin/Production/AI permission phases)
-- dropped it and never carried it forward -- so no company created after
-- Phase 4 has given its IT role ANY budget permission by default. Restored
-- here, and widened to VIEW+CREATE+UPDATE (not just VIEW) to match what
-- the other four departments' full-access roles get below, since the
-- whole point of this migration is "departments prepare their own
-- budgets" -- DELETE/APPROVE/CLOSE stay Admin-only by default, the same
-- "sensitive actions stay Admin-only" convention already used for
-- disposal/credential-reveal.
-- =========================================================================

insert into public.permissions (key, module_key, resource, action, description) values
  ('HR.BUDGET.VIEW', 'HR', 'BUDGET', 'VIEW', 'View HR department budgets'),
  ('HR.BUDGET.CREATE', 'HR', 'BUDGET', 'CREATE', 'Create and prepare an HR department budget'),
  ('HR.BUDGET.UPDATE', 'HR', 'BUDGET', 'UPDATE', 'Edit an HR department budget and its lines'),
  ('HR.BUDGET.DELETE', 'HR', 'BUDGET', 'DELETE', 'Delete an HR department budget'),
  ('FINANCE.BUDGET.CREATE', 'FINANCE', 'BUDGET', 'CREATE', 'Create and prepare a Finance department budget'),
  ('FINANCE.BUDGET.UPDATE', 'FINANCE', 'BUDGET', 'UPDATE', 'Edit a Finance department budget and its lines'),
  ('FINANCE.BUDGET.DELETE', 'FINANCE', 'BUDGET', 'DELETE', 'Delete a Finance department budget'),
  ('ADMIN.BUDGET.VIEW', 'ADMIN', 'BUDGET', 'VIEW', 'View Administration department budgets'),
  ('ADMIN.BUDGET.CREATE', 'ADMIN', 'BUDGET', 'CREATE', 'Create and prepare an Administration department budget'),
  ('ADMIN.BUDGET.UPDATE', 'ADMIN', 'BUDGET', 'UPDATE', 'Edit an Administration department budget and its lines'),
  ('ADMIN.BUDGET.DELETE', 'ADMIN', 'BUDGET', 'DELETE', 'Delete an Administration department budget'),
  ('PRODUCTION.BUDGET.VIEW2', 'PRODUCTION', 'BUDGET', 'VIEW', 'placeholder')
on conflict (key) do nothing;

-- PRODUCTION.BUDGET.VIEW/MANAGE already exist (they gate
-- get_production_budget_summary) -- remove the placeholder row above and
-- only add the two actions that don't exist yet under that resource.
delete from public.permissions where key = 'PRODUCTION.BUDGET.VIEW2';

insert into public.permissions (key, module_key, resource, action, description) values
  ('PRODUCTION.BUDGET.CREATE', 'PRODUCTION', 'BUDGET', 'CREATE', 'Create and prepare a Production department budget'),
  ('PRODUCTION.BUDGET.DELETE', 'PRODUCTION', 'BUDGET', 'DELETE', 'Delete a Production department budget'),
  ('BUDGET.FINANCE_APPROVE', 'FINANCE', 'BUDGET', 'FINANCE_APPROVE', 'Review, approve, return, reject, or close any department''s overall budget'),
  ('BUDGET.ADMIN_OVERRIDE', 'FINANCE', 'BUDGET', 'ADMIN_OVERRIDE', 'Superadmin override of the normal Finance-approval gate -- every use is audited')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Redefine seed_company_defaults(): identical to the Phase 8 version
-- (20260101000157) except the IT role's explicit list gains
-- IT.BUDGET.VIEW/CREATE/UPDATE (restoring + extending the Phase 3 default
-- that later phases silently dropped) and the Accountant role's explicit
-- list gains BUDGET.FINANCE_APPROVE. HR/Administrative Officer/Director+
-- Producer already pick up their new <DEPT>.BUDGET.* keys automatically
-- through their existing wildcard grants -- no other change needed.
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
-- Backfill: grant the new keys to existing companies' matching system
-- roles, exactly the way every prior phase's new permissions were
-- backfilled onto pre-existing companies.
-- ---------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Admin'
  and (p.key like '%.BUDGET.%' or p.key in ('BUDGET.FINANCE_APPROVE', 'BUDGET.ADMIN_OVERRIDE'))
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'IT' and p.key in ('IT.BUDGET.VIEW', 'IT.BUDGET.CREATE', 'IT.BUDGET.UPDATE')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'HR' and p.key like 'HR.BUDGET.%'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Accountant' and (p.key like 'FINANCE.BUDGET.%' or p.key = 'BUDGET.FINANCE_APPROVE')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Administrative Officer' and p.key like 'ADMIN.BUDGET.%'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name in ('Director', 'Producer') and p.key like 'PRODUCTION.BUDGET.%'
on conflict (role_id, permission_id) do nothing;
