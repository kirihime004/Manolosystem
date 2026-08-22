-- =========================================================================
-- PHASE 2: permission catalog + role grants for Inventory/Credentials/IP.
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('IT.INVENTORY.VIEW',   'IT', 'INVENTORY', 'VIEW',   'View inventory assets'),
  ('IT.INVENTORY.CREATE', 'IT', 'INVENTORY', 'CREATE', 'Create hardware/software assets'),
  ('IT.INVENTORY.UPDATE', 'IT', 'INVENTORY', 'UPDATE', 'Edit asset fields'),
  ('IT.INVENTORY.DELETE', 'IT', 'INVENTORY', 'DELETE', 'Delete an asset record'),
  ('IT.INVENTORY.ASSIGN', 'IT', 'INVENTORY', 'ASSIGN', 'Assign or reassign an asset'),
  ('IT.INVENTORY.DISPOSE','IT', 'INVENTORY', 'DISPOSE','Dispose of an asset'),
  ('IT.INVENTORY.REPAIR', 'IT', 'INVENTORY', 'REPAIR', 'Create and manage repair records'),
  ('IT.INVENTORY.EXPORT', 'IT', 'INVENTORY', 'EXPORT', 'Export inventory to CSV'),
  ('IT.INVENTORY.PRINT',  'IT', 'INVENTORY', 'PRINT',  'Print inventory reports'),

  ('IT.CREDENTIALS.VIEW',   'IT', 'CREDENTIALS', 'VIEW',   'View credential records (metadata only)'),
  ('IT.CREDENTIALS.CREATE', 'IT', 'CREDENTIALS', 'CREATE', 'Create a credential record'),
  ('IT.CREDENTIALS.UPDATE', 'IT', 'CREDENTIALS', 'UPDATE', 'Edit a credential record'),
  ('IT.CREDENTIALS.DELETE', 'IT', 'CREDENTIALS', 'DELETE', 'Delete a credential record'),
  ('IT.CREDENTIALS.REVEAL', 'IT', 'CREDENTIALS', 'REVEAL', 'Decrypt and view a credential secret (audited)'),

  ('IT.IP.VIEW',   'IT', 'IP', 'VIEW',   'View IP address inventory'),
  ('IT.IP.UPDATE',  'IT', 'IP', 'UPDATE', 'Edit IP address records'),
  ('IT.IP.MANAGE', 'IT', 'IP', 'MANAGE', 'Delete IP records and manage network agent tokens'),

  ('IT.NOTIFICATIONS.VIEW',   'IT', 'NOTIFICATIONS', 'VIEW',   'View inventory notifications'),
  ('IT.NOTIFICATIONS.MANAGE', 'IT', 'NOTIFICATIONS', 'MANAGE', 'Trigger notification generation');

-- ---------------------------------------------------------------------
-- Backfill: companies created before this migration already had their
-- Admin/IT system roles populated at creation time, so the new permission
-- rows above don't automatically reach them. Grant the same defaults a
-- newly-created company would get (see the updated seed_company_defaults()
-- below) to every existing company's system roles.
-- ---------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Admin'
  and (
    p.key like 'IT.INVENTORY.%' or p.key like 'IT.CREDENTIALS.%' or p.key like 'IT.IP.%' or p.key like 'IT.NOTIFICATIONS.%'
  )
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'IT'
  and p.key in (
    'IT.INVENTORY.VIEW', 'IT.INVENTORY.CREATE', 'IT.INVENTORY.UPDATE', 'IT.INVENTORY.ASSIGN',
    'IT.INVENTORY.REPAIR', 'IT.INVENTORY.EXPORT', 'IT.INVENTORY.PRINT',
    'IT.IP.VIEW', 'IT.IP.UPDATE',
    'IT.CREDENTIALS.VIEW',
    'IT.NOTIFICATIONS.VIEW'
  )
on conflict (role_id, permission_id) do nothing;

-- ---------------------------------------------------------------------
-- Same defaults for every company created from now on. Admin already gets
-- every permission that exists (unfiltered SELECT further up in this
-- function) -- only the IT role's explicit key list needs the additions.
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

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director)) as r(id)
  cross join public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT');

  insert into public.role_permissions (role_id, permission_id)
  select v_role_employee, p.id from public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT');

  return new;
end;
$$;
