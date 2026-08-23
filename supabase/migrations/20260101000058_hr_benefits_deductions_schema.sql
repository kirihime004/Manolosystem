-- =========================================================================
-- PHASE 4: HR-side benefits and deductions. Deliberately not payroll
-- calculation rules -- Finance will own the actual accounting; these are
-- the source-of-truth records Finance will later read from.
-- =========================================================================
create table public.employee_benefits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  benefit_type text not null check (benefit_type in (
    'HEALTH_INSURANCE', 'LIFE_INSURANCE', 'ALLOWANCE', 'TRANSPORTATION',
    'MEAL_ALLOWANCE', 'COMMUNICATION_ALLOWANCE', 'OTHER'
  )),
  provider text,
  start_date date,
  end_date date,
  amount numeric(12, 2) check (amount >= 0),
  currency_id uuid references public.currencies(id),
  frequency text check (frequency in ('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'ANNUAL', 'ONE_TIME')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'EXPIRED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index employee_benefits_employee_idx on public.employee_benefits (employee_id);
create trigger set_employee_benefits_updated_at before update on public.employee_benefits
  for each row execute function public.set_updated_at();
alter table public.employee_benefits enable row level security;

create table public.employee_deductions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  deduction_type text not null check (deduction_type in ('TAX', 'LOAN', 'INSURANCE', 'EMPLOYEE_CONTRIBUTION', 'OTHER')),
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency_id uuid references public.currencies(id),
  frequency text check (frequency in ('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'ANNUAL', 'ONE_TIME')),
  start_date date,
  end_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'COMPLETED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index employee_deductions_employee_idx on public.employee_deductions (employee_id);
create trigger set_employee_deductions_updated_at before update on public.employee_deductions
  for each row execute function public.set_updated_at();
alter table public.employee_deductions enable row level security;
