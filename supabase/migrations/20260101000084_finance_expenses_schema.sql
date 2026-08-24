-- =========================================================================
-- PHASE 5: Finance & Accounting -- Expense claims. One row per claim
-- (matches spec section 32's field list -- a single category/amount per
-- record, exactly like HR's leave_requests/overtime_requests shape), not
-- a header+items structure. References Phase 4's employees directly;
-- never a second employee table.
-- =========================================================================
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  expense_number text not null,
  employee_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  expense_date date not null default current_date,
  category text not null check (category in (
    'TRAVEL', 'MEALS', 'TRANSPORTATION', 'TRAINING', 'OFFICE', 'CLIENT', 'PRODUCTION', 'IT', 'OTHER'
  )),
  description text not null,
  amount numeric(16, 2) not null check (amount > 0),
  currency_id uuid not null references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),
  receipt_path text,
  project_id uuid, -- no FK yet: Phase 7 Production doesn't exist
  customer_id uuid references public.customers(id) on delete set null,
  account_id uuid references public.chart_of_accounts(id),
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  budget_category_id uuid references public.budget_categories(id) on delete set null,
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED'
  )),
  approver_id uuid references auth.users(id) on delete set null,
  finance_reviewer uuid references auth.users(id) on delete set null,
  journal_entry_id uuid references public.journal_entries(id),
  paid_via_cash_account_id uuid references public.cash_accounts(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, expense_number)
);
create index expenses_company_idx on public.expenses (company_id, expense_date desc);
create index expenses_employee_idx on public.expenses (employee_id);
create index expenses_status_idx on public.expenses (company_id, status);
create trigger set_expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
alter table public.expenses enable row level security;

create table public.expense_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  approval_level int not null default 1,
  sequence int not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);
create index expense_approvals_expense_idx on public.expense_approvals (expense_id);
alter table public.expense_approvals enable row level security;
