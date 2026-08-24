-- =========================================================================
-- PHASE 5: Finance & Accounting -- permission catalog.
-- FINANCE already exists as a module_key (seeded since Phase 1) and the
-- Accountant system role already exists with zero permissions granted --
-- this migration is what actually turns it into a working role, following
-- the exact "add catalog + redefine seed_company_defaults() + backfill"
-- shape used for HR in migration 048.
-- =========================================================================
insert into public.permissions (key, module_key, resource, action, description) values
  ('FINANCE.DASHBOARD.VIEW', 'FINANCE', 'DASHBOARD', 'VIEW', 'View the Finance dashboard'),

  ('FINANCE.SETTINGS.MANAGE', 'FINANCE', 'SETTINGS', 'MANAGE', 'Manage Finance settings (fiscal year, numbering, categories)'),
  ('FINANCE.PERIODS.VIEW', 'FINANCE', 'PERIODS', 'VIEW', 'View fiscal years and financial periods'),
  ('FINANCE.PERIODS.CLOSE', 'FINANCE', 'PERIODS', 'CLOSE', 'Close or reopen a financial period'),

  ('FINANCE.ACCOUNTS.VIEW', 'FINANCE', 'ACCOUNTS', 'VIEW', 'View the chart of accounts'),
  ('FINANCE.ACCOUNTS.CREATE', 'FINANCE', 'ACCOUNTS', 'CREATE', 'Create accounts'),
  ('FINANCE.ACCOUNTS.UPDATE', 'FINANCE', 'ACCOUNTS', 'UPDATE', 'Update accounts'),
  ('FINANCE.ACCOUNTS.ARCHIVE', 'FINANCE', 'ACCOUNTS', 'ARCHIVE', 'Archive accounts'),

  ('FINANCE.JOURNALS.VIEW', 'FINANCE', 'JOURNALS', 'VIEW', 'View journal entries'),
  ('FINANCE.JOURNALS.CREATE', 'FINANCE', 'JOURNALS', 'CREATE', 'Create journal entries'),
  ('FINANCE.JOURNALS.UPDATE', 'FINANCE', 'JOURNALS', 'UPDATE', 'Edit draft journal entries'),
  ('FINANCE.JOURNALS.POST', 'FINANCE', 'JOURNALS', 'POST', 'Post journal entries to the ledger'),
  ('FINANCE.JOURNALS.REVERSE', 'FINANCE', 'JOURNALS', 'REVERSE', 'Reverse posted journal entries'),
  ('FINANCE.JOURNALS.APPROVE', 'FINANCE', 'JOURNALS', 'APPROVE', 'Approve journal entries pending approval'),

  ('FINANCE.GL.VIEW', 'FINANCE', 'GL', 'VIEW', 'View the general ledger'),
  ('FINANCE.TRIAL_BALANCE.VIEW', 'FINANCE', 'TRIAL_BALANCE', 'VIEW', 'View the trial balance'),

  ('FINANCE.AP.VIEW', 'FINANCE', 'AP', 'VIEW', 'View accounts payable / supplier bills'),
  ('FINANCE.AP.CREATE', 'FINANCE', 'AP', 'CREATE', 'Create supplier bills'),
  ('FINANCE.AP.APPROVE', 'FINANCE', 'AP', 'APPROVE', 'Approve supplier bills'),
  ('FINANCE.AP.PAY', 'FINANCE', 'AP', 'PAY', 'Record supplier payments'),

  ('FINANCE.AR.VIEW', 'FINANCE', 'AR', 'VIEW', 'View accounts receivable / customer invoices'),
  ('FINANCE.AR.CREATE', 'FINANCE', 'AR', 'CREATE', 'Create customer invoices'),
  ('FINANCE.AR.APPROVE', 'FINANCE', 'AR', 'APPROVE', 'Approve/send customer invoices'),
  ('FINANCE.AR.RECEIVE_PAYMENT', 'FINANCE', 'AR', 'RECEIVE_PAYMENT', 'Record customer payments'),

  ('FINANCE.CUSTOMERS.VIEW', 'FINANCE', 'CUSTOMERS', 'VIEW', 'View the customer master list'),
  ('FINANCE.CUSTOMERS.MANAGE', 'FINANCE', 'CUSTOMERS', 'MANAGE', 'Create and edit customers'),

  ('FINANCE.EXPENSES.VIEW', 'FINANCE', 'EXPENSES', 'VIEW', 'View expense claims'),
  ('FINANCE.EXPENSES.CREATE', 'FINANCE', 'EXPENSES', 'CREATE', 'Submit expense claims'),
  ('FINANCE.EXPENSES.APPROVE', 'FINANCE', 'EXPENSES', 'APPROVE', 'Approve expense claims'),
  ('FINANCE.EXPENSES.PAY', 'FINANCE', 'EXPENSES', 'PAY', 'Pay out approved expense claims'),

  ('FINANCE.BANK.VIEW', 'FINANCE', 'BANK', 'VIEW', 'View cash and bank accounts'),
  ('FINANCE.BANK.CREATE', 'FINANCE', 'BANK', 'CREATE', 'Create cash/bank accounts and record transactions'),
  ('FINANCE.BANK.RECONCILE', 'FINANCE', 'BANK', 'RECONCILE', 'Reconcile bank accounts'),

  ('FINANCE.PAYROLL.VIEW', 'FINANCE', 'PAYROLL', 'VIEW', 'View payroll runs'),
  ('FINANCE.PAYROLL.PROCESS', 'FINANCE', 'PAYROLL', 'PROCESS', 'Process payroll runs'),
  ('FINANCE.PAYROLL.APPROVE', 'FINANCE', 'PAYROLL', 'APPROVE', 'Approve payroll runs'),
  ('FINANCE.PAYROLL.PAY', 'FINANCE', 'PAYROLL', 'PAY', 'Mark payroll runs as paid'),

  ('FINANCE.TAX.VIEW', 'FINANCE', 'TAX', 'VIEW', 'View tax rates and tax reports'),
  ('FINANCE.TAX.MANAGE', 'FINANCE', 'TAX', 'MANAGE', 'Manage tax rates'),

  ('FINANCE.BUDGET.VIEW', 'FINANCE', 'BUDGET', 'VIEW', 'View budget vs actual reporting'),

  ('FINANCE.COST_CENTERS.MANAGE', 'FINANCE', 'COST_CENTERS', 'MANAGE', 'Manage cost centers'),
  ('FINANCE.PROFIT_CENTERS.MANAGE', 'FINANCE', 'PROFIT_CENTERS', 'MANAGE', 'Manage profit centers'),

  ('FINANCE.REPORTS.VIEW', 'FINANCE', 'REPORTS', 'VIEW', 'View financial reports'),
  ('FINANCE.REPORTS.EXPORT', 'FINANCE', 'REPORTS', 'EXPORT', 'Export financial reports'),
  ('FINANCE.REPORTS.PRINT', 'FINANCE', 'REPORTS', 'PRINT', 'Print financial reports and documents'),

  ('FINANCE.DOCUMENTS.VIEW', 'FINANCE', 'DOCUMENTS', 'VIEW', 'View finance documents (receipts, invoices, tax docs)'),
  ('FINANCE.DOCUMENTS.CREATE', 'FINANCE', 'DOCUMENTS', 'CREATE', 'Upload finance documents'),
  ('FINANCE.DOCUMENTS.DELETE', 'FINANCE', 'DOCUMENTS', 'DELETE', 'Delete finance documents')
on conflict (key) do nothing;

-- =========================================================================
-- Redefine seed_company_defaults(): Accountant gets the full FINANCE.*
-- surface (there is no separate "Finance Manager" system role -- companies
-- create custom roles for segregation of duties per the Finance spec's own
-- instruction), everyone else gets baseline expense-claim self-service
-- (view/create own), matching HR's baseline self-service pattern exactly.
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

  -- Accountant: the whole FINANCE.* surface. This is the role
  -- HR.PAYROLL.APPROVE was withheld from HR for -- payroll approval is a
  -- Finance decision.
  insert into public.role_permissions (role_id, permission_id)
  select v_role_accountant, p.id from public.permissions p
  where p.key like 'FINANCE.%'
  on conflict (role_id, permission_id) do nothing;

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director)) as r(id)
  cross join public.permissions p
  where p.key in ('IT.TICKETS.CREATE', 'IT.TICKETS.COMMENT')
  on conflict (role_id, permission_id) do nothing;

  -- Every role below Admin: baseline employee self-service. v_role_hr /
  -- v_role_accountant already hold many of these from their own full-module
  -- grants above -- ON CONFLICT DO NOTHING is what makes that overlap safe.
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from (values (v_role_it), (v_role_hr), (v_role_accountant), (v_role_artist), (v_role_director), (v_role_employee)) as r(id)
  cross join public.permissions p
  where p.key in (
    'HR.DASHBOARD.VIEW', 'HR.LEAVE.VIEW', 'HR.LEAVE.CREATE',
    'HR.OVERTIME.VIEW', 'HR.OVERTIME.CREATE',
    'HR.TIMESHEETS.VIEW', 'HR.TIMESHEETS.CREATE',
    'HR.REQUESTS.VIEW', 'HR.REQUESTS.CREATE',
    'HR.DOCUMENTS.VIEW', 'HR.CONTRACTS.VIEW', 'HR.BENEFITS.VIEW',
    'FINANCE.EXPENSES.VIEW', 'FINANCE.EXPENSES.CREATE'
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
-- Backfill existing companies: grant Accountant its full FINANCE.* surface
-- and give every existing role its baseline expense self-service, exactly
-- mirroring the HR backfill shape from migration 048.
-- =========================================================================
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Accountant' and p.key like 'FINANCE.%'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name in ('IT', 'HR', 'Accountant', 'Artist', 'Director', 'Employee')
  and p.key in ('FINANCE.EXPENSES.VIEW', 'FINANCE.EXPENSES.CREATE')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system and r.name = 'Admin' and p.key like 'FINANCE.%'
on conflict (role_id, permission_id) do nothing;
