-- =========================================================================
-- PHASE 7: Animation Production Management -- permission catalog.
-- PRODUCTION already exists as a module_key (seeded since migration 003)
-- and 'Artist'/'Director' already exist as system roles anticipating this
-- phase (seed_company_defaults(), unchanged since the platform's early
-- migrations). This migration adds the full PRODUCTION.* business keys and
-- introduces two new system roles -- 'Producer' and 'Supervisor' -- the
-- same minimal-new-role shape every phase has used (Accountant, then
-- Administrative Officer), matching the spec's explicit call for
-- role-aware dashboards across Director/Producer/Artist/Supervisor.
--
-- Unlike Admin/HR/Finance, Production access is NOT given as a blanket
-- baseline to every other role -- it is a distinct department, and
-- non-production staff only ever see it through explicit project
-- membership (production_project_members), never through a company-wide
-- self-service grant. That project-membership path is wired up once
-- production_projects/production_project_members exist in a later
-- migration.
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('PRODUCTION.DASHBOARD.VIEW', 'PRODUCTION', 'DASHBOARD', 'VIEW', 'View the Production dashboard'),

  ('PRODUCTION.PROJECTS.VIEW', 'PRODUCTION', 'PROJECTS', 'VIEW', 'View production projects'),
  ('PRODUCTION.PROJECTS.CREATE', 'PRODUCTION', 'PROJECTS', 'CREATE', 'Create production projects'),
  ('PRODUCTION.PROJECTS.UPDATE', 'PRODUCTION', 'PROJECTS', 'UPDATE', 'Update production projects'),
  ('PRODUCTION.PROJECTS.MANAGE', 'PRODUCTION', 'PROJECTS', 'MANAGE', 'Archive, close, or delete production projects'),

  ('PRODUCTION.MEMBERS.MANAGE', 'PRODUCTION', 'MEMBERS', 'MANAGE', 'Add or remove project members and their project roles'),
  ('PRODUCTION.SETTINGS.MANAGE', 'PRODUCTION', 'SETTINGS', 'MANAGE', 'Manage Production settings, naming formats, and task types'),
  ('PRODUCTION.TEMPLATES.MANAGE', 'PRODUCTION', 'TEMPLATES', 'MANAGE', 'Create and manage project templates'),

  ('PRODUCTION.SHOWS.VIEW', 'PRODUCTION', 'SHOWS', 'VIEW', 'View shows'),
  ('PRODUCTION.SHOWS.CREATE', 'PRODUCTION', 'SHOWS', 'CREATE', 'Create shows'),
  ('PRODUCTION.SHOWS.UPDATE', 'PRODUCTION', 'SHOWS', 'UPDATE', 'Update shows'),

  ('PRODUCTION.EPISODES.VIEW', 'PRODUCTION', 'EPISODES', 'VIEW', 'View episodes'),
  ('PRODUCTION.EPISODES.CREATE', 'PRODUCTION', 'EPISODES', 'CREATE', 'Create episodes'),
  ('PRODUCTION.EPISODES.UPDATE', 'PRODUCTION', 'EPISODES', 'UPDATE', 'Update episodes'),

  ('PRODUCTION.SEQUENCES.VIEW', 'PRODUCTION', 'SEQUENCES', 'VIEW', 'View sequences'),
  ('PRODUCTION.SEQUENCES.CREATE', 'PRODUCTION', 'SEQUENCES', 'CREATE', 'Create sequences'),
  ('PRODUCTION.SEQUENCES.UPDATE', 'PRODUCTION', 'SEQUENCES', 'UPDATE', 'Update sequences'),

  ('PRODUCTION.SHOTS.VIEW', 'PRODUCTION', 'SHOTS', 'VIEW', 'View shots and the shot grid'),
  ('PRODUCTION.SHOTS.CREATE', 'PRODUCTION', 'SHOTS', 'CREATE', 'Create shots'),
  ('PRODUCTION.SHOTS.UPDATE', 'PRODUCTION', 'SHOTS', 'UPDATE', 'Update shots'),
  ('PRODUCTION.SHOTS.DELETE', 'PRODUCTION', 'SHOTS', 'DELETE', 'Delete shots'),

  ('PRODUCTION.ASSETS.VIEW', 'PRODUCTION', 'ASSETS', 'VIEW', 'View production assets'),
  ('PRODUCTION.ASSETS.CREATE', 'PRODUCTION', 'ASSETS', 'CREATE', 'Create production assets'),
  ('PRODUCTION.ASSETS.UPDATE', 'PRODUCTION', 'ASSETS', 'UPDATE', 'Update production assets'),
  ('PRODUCTION.ASSETS.DELETE', 'PRODUCTION', 'ASSETS', 'DELETE', 'Delete production assets'),

  ('PRODUCTION.TASKS.VIEW', 'PRODUCTION', 'TASKS', 'VIEW', 'View tasks'),
  ('PRODUCTION.TASKS.CREATE', 'PRODUCTION', 'TASKS', 'CREATE', 'Create tasks'),
  ('PRODUCTION.TASKS.UPDATE', 'PRODUCTION', 'TASKS', 'UPDATE', 'Update task status and details'),
  ('PRODUCTION.TASKS.ASSIGN', 'PRODUCTION', 'TASKS', 'ASSIGN', 'Assign or reassign tasks'),
  ('PRODUCTION.TASKS.DELETE', 'PRODUCTION', 'TASKS', 'DELETE', 'Delete tasks'),
  ('PRODUCTION.DEPENDENCIES.MANAGE', 'PRODUCTION', 'DEPENDENCIES', 'MANAGE', 'Create and remove task dependencies'),

  ('PRODUCTION.MILESTONES.VIEW', 'PRODUCTION', 'MILESTONES', 'VIEW', 'View milestones'),
  ('PRODUCTION.MILESTONES.CREATE', 'PRODUCTION', 'MILESTONES', 'CREATE', 'Create milestones'),
  ('PRODUCTION.MILESTONES.UPDATE', 'PRODUCTION', 'MILESTONES', 'UPDATE', 'Update milestones'),

  ('PRODUCTION.SCHEDULE.VIEW', 'PRODUCTION', 'SCHEDULE', 'VIEW', 'View production schedules and the calendar'),
  ('PRODUCTION.SCHEDULE.MANAGE', 'PRODUCTION', 'SCHEDULE', 'MANAGE', 'Manage production schedules'),

  ('PRODUCTION.VERSIONS.VIEW', 'PRODUCTION', 'VERSIONS', 'VIEW', 'View versions'),
  ('PRODUCTION.VERSIONS.CREATE', 'PRODUCTION', 'VERSIONS', 'CREATE', 'Submit new versions'),
  ('PRODUCTION.VERSIONS.DELETE', 'PRODUCTION', 'VERSIONS', 'DELETE', 'Delete versions'),

  ('PRODUCTION.REVIEWS.VIEW', 'PRODUCTION', 'REVIEWS', 'VIEW', 'View reviews'),
  ('PRODUCTION.REVIEWS.CREATE', 'PRODUCTION', 'REVIEWS', 'CREATE', 'Request reviews'),
  ('PRODUCTION.REVIEWS.DECIDE', 'PRODUCTION', 'REVIEWS', 'DECIDE', 'Approve, reject, or request changes on a review'),

  ('PRODUCTION.NOTES.VIEW', 'PRODUCTION', 'NOTES', 'VIEW', 'View review notes'),
  ('PRODUCTION.NOTES.CREATE', 'PRODUCTION', 'NOTES', 'CREATE', 'Create review notes'),
  ('PRODUCTION.NOTES.RESOLVE', 'PRODUCTION', 'NOTES', 'RESOLVE', 'Resolve review notes'),

  ('PRODUCTION.DELIVERABLES.VIEW', 'PRODUCTION', 'DELIVERABLES', 'VIEW', 'View deliverables'),
  ('PRODUCTION.DELIVERABLES.CREATE', 'PRODUCTION', 'DELIVERABLES', 'CREATE', 'Create deliverables'),
  ('PRODUCTION.DELIVERABLES.UPDATE', 'PRODUCTION', 'DELIVERABLES', 'UPDATE', 'Update and mark deliverables as sent'),

  ('PRODUCTION.FILES.UPLOAD', 'PRODUCTION', 'FILES', 'UPLOAD', 'Upload production files'),
  ('PRODUCTION.FILES.DELETE', 'PRODUCTION', 'FILES', 'DELETE', 'Delete production files'),

  ('PRODUCTION.CLIENT_ACCESS.MANAGE', 'PRODUCTION', 'CLIENT_ACCESS', 'MANAGE', 'Grant or revoke client portal access'),

  ('PRODUCTION.CUSTOM_FIELDS.MANAGE', 'PRODUCTION', 'CUSTOM_FIELDS', 'MANAGE', 'Configure custom fields'),
  ('PRODUCTION.WORKFLOWS.MANAGE', 'PRODUCTION', 'WORKFLOWS', 'MANAGE', 'Configure workflow templates'),

  ('PRODUCTION.BUDGET.VIEW', 'PRODUCTION', 'BUDGET', 'VIEW', 'View production budgets'),
  ('PRODUCTION.BUDGET.MANAGE', 'PRODUCTION', 'BUDGET', 'MANAGE', 'Manage production budgets'),

  ('PRODUCTION.RESOURCES.VIEW', 'PRODUCTION', 'RESOURCES', 'VIEW', 'View team workload and resource capacity'),

  ('PRODUCTION.REPORTS.VIEW', 'PRODUCTION', 'REPORTS', 'VIEW', 'View production reports'),
  ('PRODUCTION.REPORTS.EXPORT', 'PRODUCTION', 'REPORTS', 'EXPORT', 'Export production reports'),
  ('PRODUCTION.REPORTS.PRINT', 'PRODUCTION', 'REPORTS', 'PRINT', 'Print production reports')
on conflict (key) do nothing;

-- =========================================================================
-- Redefine seed_company_defaults(): add 'Producer' and 'Supervisor' system
-- roles alongside the pre-existing 'Artist'/'Director', wire up their
-- PRODUCTION.* grants, and leave every other role untouched (no blanket
-- baseline -- Production access flows through project membership, not a
-- company-wide grant).
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

  -- Admin: every permission that exists today.
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
    'IT.NOTIFICATIONS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_hr, p.id from public.permissions p
  where p.key like 'HR.%' and p.key not in ('HR.EMPLOYEES.DELETE', 'HR.PAYROLL.APPROVE')
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_accountant, p.id from public.permissions p
  where p.key like 'FINANCE.%'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin_officer, p.id from public.permissions p
  where p.key like 'ADMIN.%' and p.resource not in (
    'USERS', 'ROLES', 'DEPARTMENTS', 'IT_CATEGORIES', 'COMPANY_SETTINGS', 'AUDIT'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Director & Producer: the full PRODUCTION.* business surface -- both
  -- run projects end to end, matching the Accountant/Administrative
  -- Officer precedent of one full-surface grant per department.
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_director), (v_role_producer)) as r(id)
  cross join public.permissions p
  where p.key like 'PRODUCTION.%'
  on conflict (role_id, permission_id) do nothing;

  -- Supervisor: departmental oversight -- view everything, update/assign
  -- tasks, decide reviews, resolve notes -- but not project/settings/
  -- budget/client-access management.
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
    'PRODUCTION.REPORTS.VIEW'
  )
  on conflict (role_id, permission_id) do nothing;

  -- Artist: self-service on the pipeline -- see the project, work their
  -- tasks, submit versions, view and respond to reviews and notes.
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
    'PRODUCTION.FILES.UPLOAD'
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
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT')
  on conflict (role_id, permission_id) do nothing;

  return new;
end;
$$;

-- =========================================================================
-- Backfill existing companies: add 'Producer' and 'Supervisor' as system
-- roles and grant them the same PRODUCTION.* surfaces as above, mirroring
-- the Administrative Officer backfill shape from migration 100.
-- =========================================================================
insert into public.roles (company_id, name, description, is_system)
select c.id, 'Producer', 'Production producer: schedules, budgets, and cross-department coordination', true
from public.companies c
where not exists (
  select 1 from public.roles r where r.company_id = c.id and r.is_system and r.name = 'Producer'
);

insert into public.roles (company_id, name, description, is_system)
select c.id, 'Supervisor', 'Department supervisor: reviews and task oversight for their team', true
from public.companies c
where not exists (
  select 1 from public.roles r where r.company_id = c.id and r.is_system and r.name = 'Supervisor'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name in ('Admin', 'Director', 'Producer') and p.key like 'PRODUCTION.%'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Supervisor'
  and p.key in (
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
    'PRODUCTION.REPORTS.VIEW'
  )
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Artist'
  and p.key in (
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
    'PRODUCTION.FILES.UPLOAD'
  )
on conflict (role_id, permission_id) do nothing;
