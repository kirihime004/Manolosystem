-- =========================================================================
-- PHASE 8 Milestone 1: AI permission catalog.
--
-- Only permissions for what's actually built this milestone are seeded --
-- AI.FORECASTS.VIEW, AI.RECOMMENDATIONS.VIEW, AI.EXPORT, and
-- AI.CROSS_DEPARTMENT.VIEW gate features that don't exist yet and are
-- deferred to a later Phase 8 migration, matching the "no unused
-- permission keys" discipline every prior phase followed.
--
-- Default grants mirror the spec's own role-behavior examples: Admin gets
-- everything automatically (the existing wildcard grant in
-- seed_company_defaults() already covers any new permission). Department
-- roles get AI.ASSISTANT.VIEW plus their own department's analytics
-- permission -- the same "one full-surface grant per department" shape
-- Accountant/Administrative Officer/Director already use. Artist and
-- Employee get AI.ASSISTANT.VIEW only (personal-task-scoped questions,
-- never company-wide analytics), matching "Artist should NOT see
-- company-wide financial intelligence."
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('AI.ASSISTANT.VIEW', 'AI', 'ASSISTANT', 'VIEW', 'Use the AI Assistant chat'),
  ('AI.COMPANY_ANALYTICS.VIEW', 'AI', 'COMPANY_ANALYTICS', 'VIEW', 'View company-wide AI health and analytics'),
  ('AI.IT_ANALYTICS.VIEW', 'AI', 'IT_ANALYTICS', 'VIEW', 'View AI-generated IT intelligence'),
  ('AI.HR_ANALYTICS.VIEW', 'AI', 'HR_ANALYTICS', 'VIEW', 'View AI-generated HR intelligence'),
  ('AI.FINANCE_ANALYTICS.VIEW', 'AI', 'FINANCE_ANALYTICS', 'VIEW', 'View AI-generated Finance intelligence'),
  ('AI.ADMIN_ANALYTICS.VIEW', 'AI', 'ADMIN_ANALYTICS', 'VIEW', 'View AI-generated Administration intelligence'),
  ('AI.PRODUCTION_ANALYTICS.VIEW', 'AI', 'PRODUCTION_ANALYTICS', 'VIEW', 'View AI-generated Production intelligence'),
  ('AI.ADMIN_SETTINGS', 'AI', 'ADMIN_SETTINGS', 'MANAGE', 'Configure company AI settings, limits, and retention')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Redefine seed_company_defaults(): identical to the Phase 7 version
-- (20260101000134) plus AI.* grants appended for future companies.
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
  where p.key like 'FINANCE.%' or p.key in ('AI.ASSISTANT.VIEW', 'AI.FINANCE_ANALYTICS.VIEW')
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
-- Backfill: grant AI.* to existing companies' matching system roles the
-- same way each prior phase backfilled its own new permissions (see the
-- Producer/Supervisor backfill in 20260101000134).
-- ---------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Admin' and p.key like 'AI.%'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'IT' and p.key in ('AI.ASSISTANT.VIEW', 'AI.IT_ANALYTICS.VIEW')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'HR' and p.key in ('AI.ASSISTANT.VIEW', 'AI.HR_ANALYTICS.VIEW')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Accountant' and p.key in ('AI.ASSISTANT.VIEW', 'AI.FINANCE_ANALYTICS.VIEW')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name = 'Administrative Officer' and p.key in ('AI.ASSISTANT.VIEW', 'AI.ADMIN_ANALYTICS.VIEW')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name in ('Director', 'Producer', 'Supervisor') and p.key in ('AI.ASSISTANT.VIEW', 'AI.PRODUCTION_ANALYTICS.VIEW')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name in ('Artist', 'Employee') and p.key = 'AI.ASSISTANT.VIEW'
on conflict (role_id, permission_id) do nothing;
