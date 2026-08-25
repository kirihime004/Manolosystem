-- =========================================================================
-- PHASE 6: Administration -- permission catalog.
-- ADMIN already exists as a module_key (seeded since Phase 1, currently a
-- placeholder -- see moduleInfo.ts) and the "Admin" system role already
-- gets every permission that exists via its blanket grant in
-- seed_company_defaults(). This migration adds the new ADMIN.* business
-- keys (facilities/requests/assets/etc, per the Phase 6 spec's own list)
-- and introduces one new "Administrative Officer" system role -- the same
-- minimal-new-role shape Finance used for "Accountant" -- rather than
-- hard-coding the spec's many suggested role names (Admin Manager,
-- Facilities Officer, Travel Coordinator, ...); companies create those as
-- custom roles built from these permissions.
--
-- Naming note: these keys share the ADMIN. prefix with the pre-existing
-- company-settings permissions (ADMIN.USERS.*, ADMIN.ROLES.MANAGE,
-- ADMIN.DEPARTMENTS.MANAGE, ADMIN.IT_CATEGORIES.MANAGE,
-- ADMIN.COMPANY_SETTINGS.MANAGE, ADMIN.AUDIT.VIEW) but every resource
-- segment below is distinct, so no key string collides -- those settings
-- permissions are unrelated to this business module and stay untouched.
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('ADMIN.DASHBOARD.VIEW', 'ADMIN', 'DASHBOARD', 'VIEW', 'View the Administration dashboard'),

  ('ADMIN.REQUESTS.VIEW', 'ADMIN', 'REQUESTS', 'VIEW', 'View administrative requests'),
  ('ADMIN.REQUESTS.CREATE', 'ADMIN', 'REQUESTS', 'CREATE', 'Submit administrative requests'),
  ('ADMIN.REQUESTS.UPDATE', 'ADMIN', 'REQUESTS', 'UPDATE', 'Review, comment on, and update administrative requests'),
  ('ADMIN.REQUESTS.ASSIGN', 'ADMIN', 'REQUESTS', 'ASSIGN', 'Assign administrative requests to staff'),
  ('ADMIN.REQUESTS.APPROVE', 'ADMIN', 'REQUESTS', 'APPROVE', 'Approve or reject administrative requests'),
  ('ADMIN.REQUESTS.CLOSE', 'ADMIN', 'REQUESTS', 'CLOSE', 'Complete and close administrative requests'),

  ('ADMIN.CATEGORIES.MANAGE', 'ADMIN', 'CATEGORIES', 'MANAGE', 'Create, edit, and reorder administrative request categories'),

  ('ADMIN.FACILITIES.VIEW', 'ADMIN', 'FACILITIES', 'VIEW', 'View locations, buildings, and floors'),
  ('ADMIN.FACILITIES.CREATE', 'ADMIN', 'FACILITIES', 'CREATE', 'Create locations, buildings, and floors'),
  ('ADMIN.FACILITIES.UPDATE', 'ADMIN', 'FACILITIES', 'UPDATE', 'Update locations, buildings, and floors'),
  ('ADMIN.FACILITIES.MANAGE', 'ADMIN', 'FACILITIES', 'MANAGE', 'Full facilities management, including deactivation'),

  ('ADMIN.ROOMS.VIEW', 'ADMIN', 'ROOMS', 'VIEW', 'View rooms and their bookings'),
  ('ADMIN.ROOMS.CREATE', 'ADMIN', 'ROOMS', 'CREATE', 'Create and manage rooms'),
  ('ADMIN.ROOMS.BOOK', 'ADMIN', 'ROOMS', 'BOOK', 'Book a room'),

  ('ADMIN.WORKSPACES.VIEW', 'ADMIN', 'WORKSPACES', 'VIEW', 'View workspaces and assignments'),
  ('ADMIN.WORKSPACES.MANAGE', 'ADMIN', 'WORKSPACES', 'MANAGE', 'Create workspaces and assign/release employees'),

  ('ADMIN.SUPPLIES.VIEW', 'ADMIN', 'SUPPLIES', 'VIEW', 'View office supply inventory'),
  ('ADMIN.SUPPLIES.MANAGE', 'ADMIN', 'SUPPLIES', 'MANAGE', 'Manage office supply items and stock movements'),
  ('ADMIN.SUPPLIES.ISSUE', 'ADMIN', 'SUPPLIES', 'ISSUE', 'Approve and issue office supply requests'),

  ('ADMIN.ASSETS.VIEW', 'ADMIN', 'ASSETS', 'VIEW', 'View administrative assets'),
  ('ADMIN.ASSETS.CREATE', 'ADMIN', 'ASSETS', 'CREATE', 'Register new administrative assets'),
  ('ADMIN.ASSETS.UPDATE', 'ADMIN', 'ASSETS', 'UPDATE', 'Update administrative assets'),
  ('ADMIN.ASSETS.ASSIGN', 'ADMIN', 'ASSETS', 'ASSIGN', 'Assign or reassign administrative assets'),
  ('ADMIN.ASSETS.DISPOSE', 'ADMIN', 'ASSETS', 'DISPOSE', 'Retire or dispose administrative assets'),

  ('ADMIN.MAINTENANCE.VIEW', 'ADMIN', 'MAINTENANCE', 'VIEW', 'View maintenance requests and schedules'),
  ('ADMIN.MAINTENANCE.CREATE', 'ADMIN', 'MAINTENANCE', 'CREATE', 'Report maintenance issues and schedule preventive maintenance'),
  ('ADMIN.MAINTENANCE.ASSIGN', 'ADMIN', 'MAINTENANCE', 'ASSIGN', 'Assign and schedule maintenance work'),
  ('ADMIN.MAINTENANCE.COMPLETE', 'ADMIN', 'MAINTENANCE', 'COMPLETE', 'Mark maintenance work complete'),

  ('ADMIN.VEHICLES.VIEW', 'ADMIN', 'VEHICLES', 'VIEW', 'View the company vehicle fleet'),
  ('ADMIN.VEHICLES.MANAGE', 'ADMIN', 'VEHICLES', 'MANAGE', 'Manage vehicles and vehicle maintenance records'),
  ('ADMIN.VEHICLES.ASSIGN', 'ADMIN', 'VEHICLES', 'ASSIGN', 'Assign or reassign vehicles'),

  ('ADMIN.TRAVEL.VIEW', 'ADMIN', 'TRAVEL', 'VIEW', 'View travel requests'),
  ('ADMIN.TRAVEL.CREATE', 'ADMIN', 'TRAVEL', 'CREATE', 'Submit travel requests'),
  ('ADMIN.TRAVEL.APPROVE', 'ADMIN', 'TRAVEL', 'APPROVE', 'Approve travel requests'),
  ('ADMIN.TRAVEL.MANAGE', 'ADMIN', 'TRAVEL', 'MANAGE', 'Coordinate bookings and manage travel requests end to end'),

  ('ADMIN.VISITORS.VIEW', 'ADMIN', 'VISITORS', 'VIEW', 'View visitor records'),
  ('ADMIN.VISITORS.CREATE', 'ADMIN', 'VISITORS', 'CREATE', 'Register expected visitors'),
  ('ADMIN.VISITORS.CHECKIN', 'ADMIN', 'VISITORS', 'CHECKIN', 'Check visitors in'),
  ('ADMIN.VISITORS.CHECKOUT', 'ADMIN', 'VISITORS', 'CHECKOUT', 'Check visitors out'),

  ('ADMIN.MEETINGS.VIEW', 'ADMIN', 'MEETINGS', 'VIEW', 'View meetings'),
  ('ADMIN.MEETINGS.CREATE', 'ADMIN', 'MEETINGS', 'CREATE', 'Schedule meetings'),
  ('ADMIN.MEETINGS.MANAGE', 'ADMIN', 'MEETINGS', 'MANAGE', 'Manage any meeting, not just ones organized by self'),

  ('ADMIN.EVENTS.VIEW', 'ADMIN', 'EVENTS', 'VIEW', 'View company events'),
  ('ADMIN.EVENTS.CREATE', 'ADMIN', 'EVENTS', 'CREATE', 'Create company events'),
  ('ADMIN.EVENTS.MANAGE', 'ADMIN', 'EVENTS', 'MANAGE', 'Manage event tasks and budgets'),

  ('ADMIN.CONTRACTS.VIEW', 'ADMIN', 'CONTRACTS', 'VIEW', 'View administrative contracts'),
  ('ADMIN.CONTRACTS.CREATE', 'ADMIN', 'CONTRACTS', 'CREATE', 'Create administrative contracts'),
  ('ADMIN.CONTRACTS.UPDATE', 'ADMIN', 'CONTRACTS', 'UPDATE', 'Update administrative contracts'),
  ('ADMIN.CONTRACTS.RENEW', 'ADMIN', 'CONTRACTS', 'RENEW', 'Renew, amend, or terminate contracts'),

  ('ADMIN.DOCUMENTS.VIEW', 'ADMIN', 'DOCUMENTS', 'VIEW', 'View administrative documents'),
  ('ADMIN.DOCUMENTS.UPLOAD', 'ADMIN', 'DOCUMENTS', 'UPLOAD', 'Upload administrative documents'),
  ('ADMIN.DOCUMENTS.DELETE', 'ADMIN', 'DOCUMENTS', 'DELETE', 'Delete administrative documents'),

  ('ADMIN.COMPLIANCE.VIEW', 'ADMIN', 'COMPLIANCE', 'VIEW', 'View compliance records'),
  ('ADMIN.COMPLIANCE.CREATE', 'ADMIN', 'COMPLIANCE', 'CREATE', 'Create compliance records'),
  ('ADMIN.COMPLIANCE.UPDATE', 'ADMIN', 'COMPLIANCE', 'UPDATE', 'Update compliance records'),

  ('ADMIN.ANNOUNCEMENTS.VIEW', 'ADMIN', 'ANNOUNCEMENTS', 'VIEW', 'View company announcements'),
  ('ADMIN.ANNOUNCEMENTS.CREATE', 'ADMIN', 'ANNOUNCEMENTS', 'CREATE', 'Create company announcements'),
  ('ADMIN.ANNOUNCEMENTS.MANAGE', 'ADMIN', 'ANNOUNCEMENTS', 'MANAGE', 'Edit, publish, or retract any announcement'),

  ('ADMIN.COURIER.VIEW', 'ADMIN', 'COURIER', 'VIEW', 'View courier and mail records'),
  ('ADMIN.COURIER.MANAGE', 'ADMIN', 'COURIER', 'MANAGE', 'Log and update courier and mail records'),

  ('ADMIN.SETTINGS.MANAGE', 'ADMIN', 'SETTINGS', 'MANAGE', 'Manage Administration settings and categories'),

  ('ADMIN.REPORTS.VIEW', 'ADMIN', 'REPORTS', 'VIEW', 'View administrative reports'),
  ('ADMIN.REPORTS.EXPORT', 'ADMIN', 'REPORTS', 'EXPORT', 'Export administrative reports'),
  ('ADMIN.REPORTS.PRINT', 'ADMIN', 'REPORTS', 'PRINT', 'Print administrative reports and documents')
on conflict (key) do nothing;

-- =========================================================================
-- Redefine seed_company_defaults(): add the "Administrative Officer"
-- system role (full ADMIN.* business surface, mirroring Accountant's
-- full FINANCE.* grant), plus baseline self-service (submit requests,
-- submit travel, view own things) for every other role, mirroring the
-- expense/leave self-service baseline Finance/HR already grant broadly.
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

  -- Admin: every permission that exists today.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin, p.id from public.permissions p
  on conflict (role_id, permission_id) do nothing;

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
  )
  on conflict (role_id, permission_id) do nothing;

  -- HR: the whole HR.* surface except deleting employees and approving payroll.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_hr, p.id from public.permissions p
  where p.key like 'HR.%' and p.key not in ('HR.EMPLOYEES.DELETE', 'HR.PAYROLL.APPROVE')
  on conflict (role_id, permission_id) do nothing;

  -- Accountant: the whole FINANCE.* surface.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_accountant, p.id from public.permissions p
  where p.key like 'FINANCE.%'
  on conflict (role_id, permission_id) do nothing;

  -- Administrative Officer: the whole ADMIN.* business surface, minus the
  -- pre-existing company-settings ADMIN.* keys (Users/Roles/Departments/
  -- IT Categories/Company Settings/Audit) which stay Admin-role-only.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin_officer, p.id from public.permissions p
  where p.key like 'ADMIN.%' and p.resource not in (
    'USERS', 'ROLES', 'DEPARTMENTS', 'IT_CATEGORIES', 'COMPANY_SETTINGS', 'AUDIT'
  )
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director)) as r(id)
  cross join public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT')
  on conflict (role_id, permission_id) do nothing;

  -- Every role below Admin: baseline employee self-service. Roles already
  -- holding many of these from their own full-module grants above is fine --
  -- ON CONFLICT DO NOTHING is what makes that overlap safe.
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_it), (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director), (v_role_employee), (v_role_admin_officer)) as r(id)
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
-- Backfill existing companies: add "Administrative Officer" as a system
-- role, grant it the full ADMIN.* business surface, and give every
-- existing role the same baseline Admin self-service, exactly mirroring
-- the Accountant/FINANCE.* backfill shape from migration 072.
-- =========================================================================
insert into public.roles (company_id, name, description, is_system)
select c.id, 'Administrative Officer', 'Administration department staff: facilities, requests, assets, travel, and office operations', true
from public.companies c
where not exists (
  select 1 from public.roles r where r.company_id = c.id and r.is_system and r.name = 'Administrative Officer'
);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Administrative Officer'
  and p.key like 'ADMIN.%' and p.resource not in (
    'USERS', 'ROLES', 'DEPARTMENTS', 'IT_CATEGORIES', 'COMPANY_SETTINGS', 'AUDIT'
  )
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name in ('IT', 'HR', 'Accountant', 'Artist', 'Director', 'Employee', 'Administrative Officer')
  and p.key in (
    'ADMIN.DASHBOARD.VIEW', 'ADMIN.REQUESTS.VIEW', 'ADMIN.REQUESTS.CREATE',
    'ADMIN.ROOMS.VIEW', 'ADMIN.ROOMS.BOOK', 'ADMIN.SUPPLIES.VIEW',
    'ADMIN.TRAVEL.VIEW', 'ADMIN.TRAVEL.CREATE',
    'ADMIN.MEETINGS.VIEW', 'ADMIN.MEETINGS.CREATE',
    'ADMIN.ANNOUNCEMENTS.VIEW'
  )
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Admin' and p.key like 'ADMIN.%'
on conflict (role_id, permission_id) do nothing;
