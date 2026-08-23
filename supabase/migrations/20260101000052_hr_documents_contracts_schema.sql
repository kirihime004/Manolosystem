-- =========================================================================
-- PHASE 4: Employee documents (private storage metadata -- the actual
-- files live in the employee-documents bucket, see 062_hr_storage.sql)
-- and employment contracts.
-- =========================================================================
create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  document_type text not null check (document_type in (
    'EMPLOYMENT_CONTRACT', 'ID_DOCUMENT', 'RESUME', 'CERTIFICATE', 'TRAINING_CERTIFICATE',
    'MEDICAL_CERTIFICATE', 'GOVERNMENT_DOCUMENT', 'TAX_DOCUMENT', 'OTHER'
  )),
  title text not null,
  document_number text,
  issue_date date,
  expiry_date date,
  storage_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'ARCHIVED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employee_documents_employee_idx on public.employee_documents (employee_id);
create index employee_documents_expiry_idx on public.employee_documents (company_id, expiry_date) where expiry_date is not null;
create trigger set_employee_documents_updated_at before update on public.employee_documents
  for each row execute function public.set_updated_at();
alter table public.employee_documents enable row level security;

-- ---------------------------------------------------------------------
-- Employment contracts. Salary reference is intentionally on this table
-- (not just employee_compensation) so a contract can be reviewed on its
-- own, but it carries the same RLS sensitivity as compensation --
-- HR.EMPLOYEES.VIEW_SALARY is required to read the column (see 063).
-- ---------------------------------------------------------------------
create table public.employment_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contract_number text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  contract_type text not null check (contract_type in ('FIXED_TERM', 'PERMANENT', 'PROBATIONARY', 'CONTRACTOR_AGREEMENT')),
  start_date date not null,
  end_date date,
  position_id uuid references public.positions(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  employment_type_id uuid references public.employment_types(id) on delete set null,
  salary_reference numeric(14, 2),
  currency_id uuid references public.currencies(id),
  working_hours text,
  work_location text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'RENEWED', 'TERMINATED')),
  document_id uuid references public.employee_documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, contract_number),
  check (end_date is null or end_date >= start_date)
);

create index employment_contracts_employee_idx on public.employment_contracts (employee_id);
create index employment_contracts_end_date_idx on public.employment_contracts (company_id, end_date) where end_date is not null;
create trigger set_employment_contracts_updated_at before update on public.employment_contracts
  for each row execute function public.set_updated_at();
alter table public.employment_contracts enable row level security;

create or replace function public.before_insert_employment_contract()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.contract_number is null or new.contract_number = '' then
    new.contract_number := public.generate_asset_code(new.company_id, 'CTR');
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger before_insert_employment_contract_trigger
  before insert on public.employment_contracts
  for each row execute function public.before_insert_employment_contract();

create or replace function public.after_write_employment_contract()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_employee_event(new.company_id, new.employee_id, 'CONTRACT_CREATED', 'contract', null, new.contract_number);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_employee_event(new.company_id, new.employee_id, 'CONTRACT_' || new.status, 'contract_status', old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger after_write_employment_contract_trigger
  after insert or update on public.employment_contracts
  for each row execute function public.after_write_employment_contract();
