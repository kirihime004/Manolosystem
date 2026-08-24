-- =========================================================================
-- PHASE 5: Finance & Accounting -- Payroll. Extends Phase 4's
-- payroll_periods (never duplicated) with the actual run/line-item tables
-- HR deliberately left for Finance to build. Statutory contribution rates
-- (SSS/PhilHealth/Pag-IBIG) reuse the existing tax_rates table rather than
-- a new config table -- widened here to cover them as flat, effective-
-- dated percentages. A real bracket-based SSS/PhilHealth table is a
-- documented future enhancement (see the final report); this is a
-- deliberate, disclosed simplification, not a silent shortcut.
-- =========================================================================
alter table public.tax_rates drop constraint tax_rates_tax_type_check;
alter table public.tax_rates add constraint tax_rates_tax_type_check check (tax_type in (
  'VAT', 'WITHHOLDING_TAX', 'SALES_TAX',
  'SSS_EMPLOYEE', 'SSS_EMPLOYER', 'PHILHEALTH_EMPLOYEE', 'PHILHEALTH_EMPLOYER',
  'PAGIBIG_EMPLOYEE', 'PAGIBIG_EMPLOYER', 'OTHER'
));

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete restrict,
  run_type text not null default 'REGULAR' check (run_type in ('REGULAR', 'THIRTEENTH_MONTH')),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'PROCESSING', 'REVIEW', 'APPROVED', 'PAID', 'CLOSED', 'CANCELLED'
  )),
  currency_id uuid not null references public.currencies(id),
  total_gross_pay numeric(16, 2) not null default 0,
  total_deductions numeric(16, 2) not null default 0,
  total_employer_contributions numeric(16, 2) not null default 0,
  total_net_pay numeric(16, 2) not null default 0,
  journal_entry_id uuid references public.journal_entries(id),
  payment_journal_entry_id uuid references public.journal_entries(id),
  processed_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_period_id, run_type)
);
create index payroll_runs_company_idx on public.payroll_runs (company_id);
create trigger set_payroll_runs_updated_at before update on public.payroll_runs
  for each row execute function public.set_updated_at();
alter table public.payroll_runs enable row level security;

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  basic_salary numeric(14, 2) not null default 0,
  allowances numeric(14, 2) not null default 0,
  overtime_hours numeric(6, 2) not null default 0,
  overtime_pay numeric(14, 2) not null default 0,
  bonuses numeric(14, 2) not null default 0,
  gross_pay numeric(14, 2) not null default 0,
  sss_employee numeric(14, 2) not null default 0,
  philhealth_employee numeric(14, 2) not null default 0,
  pagibig_employee numeric(14, 2) not null default 0,
  withholding_tax numeric(14, 2) not null default 0,
  other_deductions numeric(14, 2) not null default 0,
  total_deductions numeric(14, 2) not null default 0,
  sss_employer numeric(14, 2) not null default 0,
  philhealth_employer numeric(14, 2) not null default 0,
  pagibig_employer numeric(14, 2) not null default 0,
  total_employer_contributions numeric(14, 2) not null default 0,
  net_pay numeric(14, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);
create index payroll_items_run_idx on public.payroll_items (payroll_run_id);
create index payroll_items_employee_idx on public.payroll_items (employee_id);
create trigger set_payroll_items_updated_at before update on public.payroll_items
  for each row execute function public.set_updated_at();
alter table public.payroll_items enable row level security;
