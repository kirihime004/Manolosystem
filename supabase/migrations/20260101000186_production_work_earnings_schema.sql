-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 3: the
-- payable-work snapshot and its approval chain. production_work_earnings
-- is created once, at submission -- everything about the rate/unit/
-- currency is frozen at that moment and never recalculated even if the
-- rate card changes later (TEST 5's exact requirement). Requested and
-- approved quantity/amount are both kept forever, never overwriting one
-- another (mirrors budget_lines from the Budget & Procurement work).
--
-- production_work_approvals mirrors purchase_request_approvals exactly,
-- reusing the SAME approval_policies table Procurement/Leave/Journal
-- Entries/Bills/Expenses/Admin Requests/Travel already share -- widened
-- with one more module value rather than inventing a new mechanism.
-- =========================================================================

alter table public.approval_policies drop constraint approval_policies_module_check;
alter table public.approval_policies add constraint approval_policies_module_check
  check (module in (
    'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'LEAVE_REQUEST', 'OVERTIME_REQUEST',
    'JOURNAL_ENTRY', 'BILL', 'EXPENSE', 'PAYROLL', 'ADMIN_REQUEST', 'TRAVEL_REQUEST', 'PRODUCTION_WORK'
  ));

alter table public.production_history drop constraint production_history_resource_type_check;
alter table public.production_history add constraint production_history_resource_type_check
  check (resource_type in ('PROJECT', 'SHOW', 'EPISODE', 'SEQUENCE', 'SHOT', 'ASSET', 'TASK', 'VERSION', 'REVIEW', 'MILESTONE', 'DELIVERABLE', 'WORK_EARNING'));

create table public.production_work_earnings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  sequence_id uuid references public.production_sequences(id) on delete set null,
  shot_id uuid references public.production_shots(id) on delete set null,
  asset_id uuid references public.production_assets(id) on delete set null,
  task_id uuid not null references public.production_tasks(id) on delete cascade,
  version_id uuid references public.production_versions(id) on delete set null,
  employee_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  rate_card_id uuid references public.production_rate_cards(id) on delete set null,
  rate numeric(16, 2) not null,
  production_unit_id uuid not null references public.production_units(id) on delete restrict,
  currency_id uuid not null references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  requested_quantity numeric(12, 2) not null check (requested_quantity > 0),
  approved_quantity numeric(12, 2),
  requested_amount numeric(16, 2) not null,
  approved_amount numeric(16, 2),
  base_currency_amount numeric(16, 2),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUIRED', 'APPROVED', 'REJECTED',
    'PAYABLE', 'SENT_TO_FINANCE', 'IN_PAYROLL', 'PAID', 'CANCELLED'
  )),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_to_finance_at timestamptz,
  payroll_item_id uuid references public.payroll_items(id) on delete set null,
  payroll_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index production_work_earnings_company_idx on public.production_work_earnings (company_id, status);
create index production_work_earnings_employee_idx on public.production_work_earnings (employee_id, status);
create index production_work_earnings_task_idx on public.production_work_earnings (task_id);
create index production_work_earnings_project_idx on public.production_work_earnings (project_id);
create trigger set_production_work_earnings_updated_at before update on public.production_work_earnings
  for each row execute function public.set_updated_at();
alter table public.production_work_earnings enable row level security;

create table public.production_work_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_earning_id uuid not null references public.production_work_earnings(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  approval_level integer not null default 1,
  sequence integer not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUIRED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);

create index production_work_approvals_earning_idx on public.production_work_approvals (work_earning_id, sequence);
alter table public.production_work_approvals enable row level security;

-- ---------------------------------------------------------------------
-- Adjustments: audited post-approval corrections. Never edits the
-- original earning row -- the sum of adjustments alongside the frozen
-- approved_amount is the real picture, exactly like budget_transactions'
-- append-only ledger design.
-- ---------------------------------------------------------------------
create table public.production_work_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  work_earning_id uuid not null references public.production_work_earnings(id) on delete cascade,
  adjustment_amount numeric(16, 2) not null,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index production_work_adjustments_earning_idx on public.production_work_adjustments (work_earning_id);
alter table public.production_work_adjustments enable row level security;

grant select, insert, update, delete on public.production_work_earnings, public.production_work_approvals, public.production_work_adjustments to authenticated;
