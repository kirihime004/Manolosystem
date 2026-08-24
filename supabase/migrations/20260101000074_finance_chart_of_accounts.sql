-- =========================================================================
-- PHASE 5: Finance & Accounting -- Chart of Accounts.
-- Auto-seeded per company (like budget_categories/employment_types) since
-- the journal engine needs accounts to exist before anyone can post
-- anything. Starter accounts are flagged is_system so they survive
-- accidental deletion attempts, but every account -- system or not -- can
-- be renamed/archived by the company; only the account code + type are
-- locked once transactions reference it (enforced in the update trigger).
-- =========================================================================
create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS')),
  parent_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  -- Header/summary accounts (the X000 top-level rows) group their children
  -- for reporting but are never postable to directly -- enforced when
  -- journal entry lines are validated in migration 077.
  is_header boolean not null default false,
  is_system boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);
create index chart_of_accounts_company_idx on public.chart_of_accounts (company_id, code);
create index chart_of_accounts_parent_idx on public.chart_of_accounts (parent_account_id);
create trigger set_chart_of_accounts_updated_at before update on public.chart_of_accounts
  for each row execute function public.set_updated_at();
alter table public.chart_of_accounts enable row level security;

-- Prevent an account becoming its own ancestor (identical shape to
-- departments' check_department_hierarchy_trigger from Phase 1).
create or replace function public.check_chart_of_accounts_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current uuid;
begin
  if new.parent_account_id is null then
    return new;
  end if;
  if new.parent_account_id = new.id then
    raise exception 'An account cannot be its own parent';
  end if;
  v_current := new.parent_account_id;
  while v_current is not null loop
    if v_current = new.id then
      raise exception 'Account hierarchy cannot contain a cycle';
    end if;
    select parent_account_id into v_current from public.chart_of_accounts where id = v_current;
  end loop;
  return new;
end;
$$;

create trigger check_chart_of_accounts_hierarchy_trigger
  before insert or update of parent_account_id on public.chart_of_accounts
  for each row execute function public.check_chart_of_accounts_hierarchy();

-- ---------------------------------------------------------------------
-- Starter chart of accounts (spec section 6/7). Companies can rename,
-- archive, or add their own accounts freely from Finance Settings --
-- these are a starting point, not a permanent structure.
-- ---------------------------------------------------------------------
create or replace function public.seed_chart_of_accounts(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assets uuid; v_liabilities uuid; v_equity uuid; v_revenue uuid; v_cogs uuid; v_expenses uuid;
begin
  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '1000', 'Assets', 'ASSET', true, true) returning id into v_assets;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '1100', 'Cash', 'ASSET', v_assets, true),
    (p_company_id, '1110', 'Bank', 'ASSET', v_assets, true),
    (p_company_id, '1120', 'Petty Cash', 'ASSET', v_assets, true),
    (p_company_id, '1200', 'Accounts Receivable', 'ASSET', v_assets, true),
    (p_company_id, '1300', 'Inventory', 'ASSET', v_assets, true),
    (p_company_id, '1400', 'Prepaid Expenses', 'ASSET', v_assets, true),
    (p_company_id, '1500', 'Fixed Assets', 'ASSET', v_assets, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '2000', 'Liabilities', 'LIABILITY', true, true) returning id into v_liabilities;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '2100', 'Accounts Payable', 'LIABILITY', v_liabilities, true),
    (p_company_id, '2200', 'Taxes Payable', 'LIABILITY', v_liabilities, true),
    (p_company_id, '2300', 'Payroll Liabilities', 'LIABILITY', v_liabilities, true),
    (p_company_id, '2400', 'Loans', 'LIABILITY', v_liabilities, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '3000', 'Equity', 'EQUITY', true, true) returning id into v_equity;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '3100', 'Owner Equity', 'EQUITY', v_equity, true),
    (p_company_id, '3200', 'Retained Earnings', 'EQUITY', v_equity, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '4000', 'Revenue', 'REVENUE', true, true) returning id into v_revenue;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '4100', 'Animation Revenue', 'REVENUE', v_revenue, true),
    (p_company_id, '4200', 'Service Revenue', 'REVENUE', v_revenue, true),
    (p_company_id, '4300', 'Other Revenue', 'REVENUE', v_revenue, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '5000', 'Cost of Goods Sold', 'COGS', true, true) returning id into v_cogs;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '5100', 'Production Costs', 'COGS', v_cogs, true),
    (p_company_id, '5200', 'Direct Costs', 'COGS', v_cogs, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '6000', 'Expenses', 'EXPENSE', true, true) returning id into v_expenses;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '6100', 'Salaries', 'EXPENSE', v_expenses, true),
    (p_company_id, '6200', 'Rent', 'EXPENSE', v_expenses, true),
    (p_company_id, '6300', 'Utilities', 'EXPENSE', v_expenses, true),
    (p_company_id, '6400', 'Software', 'EXPENSE', v_expenses, true),
    (p_company_id, '6500', 'IT Expenses', 'EXPENSE', v_expenses, true),
    (p_company_id, '6600', 'Travel', 'EXPENSE', v_expenses, true),
    (p_company_id, '6700', 'Office Expenses', 'EXPENSE', v_expenses, true),
    (p_company_id, '6800', 'Marketing', 'EXPENSE', v_expenses, true),
    (p_company_id, '6900', 'Other Expenses', 'EXPENSE', v_expenses, true);
end;
$$;

create or replace function public.after_insert_company_seed_chart_of_accounts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_chart_of_accounts(new.id);
  return new;
end;
$$;

create trigger after_insert_company_seed_chart_of_accounts_trigger
  after insert on public.companies
  for each row execute function public.after_insert_company_seed_chart_of_accounts();

-- Backfill existing companies that predate this migration.
do $$
declare v_company record;
begin
  for v_company in select id from public.companies loop
    if not exists (select 1 from public.chart_of_accounts where company_id = v_company.id) then
      perform public.seed_chart_of_accounts(v_company.id);
    end if;
  end loop;
end $$;
