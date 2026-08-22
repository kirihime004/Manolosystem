-- =========================================================================
-- PHASE 3: permission catalog + role grants for Budget/Procurement/
-- Suppliers/Currency.
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('IT.BUDGET.VIEW',   'IT', 'BUDGET', 'VIEW',   'View IT budgets'),
  ('IT.BUDGET.CREATE', 'IT', 'BUDGET', 'CREATE', 'Create budgets and categories'),
  ('IT.BUDGET.UPDATE', 'IT', 'BUDGET', 'UPDATE', 'Edit budgets, categories, and allocations'),
  ('IT.BUDGET.DELETE', 'IT', 'BUDGET', 'DELETE', 'Delete a budget'),
  ('IT.BUDGET.APPROVE','IT', 'BUDGET', 'APPROVE','Approve budget-related requests'),
  ('IT.BUDGET.CLOSE',  'IT', 'BUDGET', 'CLOSE',  'Close or archive a budget period'),

  ('IT.PROCUREMENT.VIEW',       'IT', 'PROCUREMENT', 'VIEW',       'View procurement records'),
  ('IT.PROCUREMENT.CREATE',     'IT', 'PROCUREMENT', 'CREATE',     'Create purchase requests and quotations'),
  ('IT.PROCUREMENT.UPDATE',     'IT', 'PROCUREMENT', 'UPDATE',     'Edit procurement records'),
  ('IT.PROCUREMENT.DELETE',     'IT', 'PROCUREMENT', 'DELETE',     'Delete a purchase request'),
  ('IT.PROCUREMENT.SUBMIT',     'IT', 'PROCUREMENT', 'SUBMIT',     'Submit a purchase request for approval'),
  ('IT.PROCUREMENT.APPROVE',    'IT', 'PROCUREMENT', 'APPROVE',    'Approve or reject a purchase request'),
  ('IT.PROCUREMENT.REJECT',     'IT', 'PROCUREMENT', 'REJECT',     'Reject a purchase request'),
  ('IT.PROCUREMENT.CREATE_PO',  'IT', 'PROCUREMENT', 'CREATE_PO',  'Convert an approved request into a purchase order'),
  ('IT.PROCUREMENT.APPROVE_PO', 'IT', 'PROCUREMENT', 'APPROVE_PO', 'Approve a purchase order'),
  ('IT.PROCUREMENT.RECEIVE',    'IT', 'PROCUREMENT', 'RECEIVE',    'Record deliveries and receive items'),
  ('IT.PROCUREMENT.EXPORT',     'IT', 'PROCUREMENT', 'EXPORT',     'Export procurement data to CSV'),
  ('IT.PROCUREMENT.PRINT',      'IT', 'PROCUREMENT', 'PRINT',      'Print procurement documents'),

  ('IT.SUPPLIERS.VIEW',   'IT', 'SUPPLIERS', 'VIEW',   'View suppliers'),
  ('IT.SUPPLIERS.CREATE', 'IT', 'SUPPLIERS', 'CREATE', 'Create a supplier'),
  ('IT.SUPPLIERS.UPDATE', 'IT', 'SUPPLIERS', 'UPDATE', 'Edit a supplier'),
  ('IT.SUPPLIERS.DELETE', 'IT', 'SUPPLIERS', 'DELETE', 'Delete a supplier'),

  ('IT.CURRENCY.VIEW',         'IT', 'CURRENCY', 'VIEW',         'View currencies and exchange rates'),
  ('IT.CURRENCY.MANAGE',       'IT', 'CURRENCY', 'MANAGE',       'Change the company base currency'),
  ('IT.CURRENCY.UPDATE_RATES', 'IT', 'CURRENCY', 'UPDATE_RATES', 'Add and manage exchange rates');

-- Backfill onto existing companies' Admin/IT system roles (same pattern as
-- the Phase 2 inventory permission backfill).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Admin'
  and (
    p.key like 'IT.BUDGET.%' or p.key like 'IT.PROCUREMENT.%' or p.key like 'IT.SUPPLIERS.%' or p.key like 'IT.CURRENCY.%'
  )
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'IT'
  and p.key in (
    'IT.BUDGET.VIEW',
    'IT.PROCUREMENT.VIEW', 'IT.PROCUREMENT.CREATE', 'IT.PROCUREMENT.UPDATE', 'IT.PROCUREMENT.SUBMIT',
    'IT.PROCUREMENT.CREATE_PO', 'IT.PROCUREMENT.RECEIVE', 'IT.PROCUREMENT.EXPORT', 'IT.PROCUREMENT.PRINT',
    'IT.SUPPLIERS.VIEW', 'IT.SUPPLIERS.CREATE', 'IT.SUPPLIERS.UPDATE',
    'IT.CURRENCY.VIEW'
  )
on conflict (role_id, permission_id) do nothing;

-- Employee/HR/Accountant/Artist/Director roles get the ability to create
-- and submit their own purchase requests (e.g. "I need a new laptop"),
-- matching the spec's "normal employees can create requests" access level.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name in ('Employee', 'HR', 'Accountant', 'Artist', 'Director')
  and p.key in ('IT.PROCUREMENT.CREATE', 'IT.PROCUREMENT.SUBMIT')
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
  values (new.id, 'IT', 'IT staff: manage and resolve tickets, inventory, and procurement', true)
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

  insert into public.role_permissions (role_id, permission_id)
  select v_role_admin, p.id from public.permissions p;

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
    'IT.BUDGET.VIEW',
    'IT.PROCUREMENT.VIEW', 'IT.PROCUREMENT.CREATE', 'IT.PROCUREMENT.UPDATE', 'IT.PROCUREMENT.SUBMIT',
    'IT.PROCUREMENT.CREATE_PO', 'IT.PROCUREMENT.RECEIVE', 'IT.PROCUREMENT.EXPORT', 'IT.PROCUREMENT.PRINT',
    'IT.SUPPLIERS.VIEW', 'IT.SUPPLIERS.CREATE', 'IT.SUPPLIERS.UPDATE',
    'IT.CURRENCY.VIEW'
  );

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director)) as r(id)
  cross join public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT', 'IT.PROCUREMENT.CREATE', 'IT.PROCUREMENT.SUBMIT');

  insert into public.role_permissions (role_id, permission_id)
  select v_role_employee, p.id from public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT', 'IT.PROCUREMENT.CREATE', 'IT.PROCUREMENT.SUBMIT');

  return new;
end;
$$;
