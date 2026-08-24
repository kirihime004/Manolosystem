-- =========================================================================
-- PHASE 5: Finance & Accounting -- Accounts Payable.
-- Extends the existing Phase 2 suppliers table (never duplicated) with the
-- remittance details Finance needs to actually pay one. bank_account_id on
-- supplier_payments is a bare uuid for now -- cash_accounts doesn't exist
-- until the Cash & Bank migration -- and gets its FK attached there,
-- matching the deferred-FK pattern already used for journal_entry_lines.
-- =========================================================================
alter table public.suppliers add column bank_name text;
alter table public.suppliers add column bank_account_name text;
alter table public.suppliers add column bank_account_number text;

create table public.supplier_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bill_number text not null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  bill_date date not null default current_date,
  due_date date not null,
  currency_id uuid not null references public.currencies(id),
  subtotal numeric(16, 2) not null default 0 check (subtotal >= 0),
  tax numeric(16, 2) not null default 0 check (tax >= 0),
  discount numeric(16, 2) not null default 0 check (discount >= 0),
  total numeric(16, 2) not null default 0 check (total >= 0),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_total numeric(16, 2),
  paid_amount numeric(16, 2) not null default 0 check (paid_amount >= 0),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'
  )),
  match_status text not null default 'NOT_APPLICABLE' check (match_status in ('MATCHED', 'MISMATCH', 'NOT_APPLICABLE')),
  matched_at timestamptz,
  department_id uuid references public.departments(id) on delete set null,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  budget_id uuid references public.budgets(id) on delete set null,
  budget_category_id uuid references public.budget_categories(id) on delete set null,
  journal_entry_id uuid references public.journal_entries(id),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, bill_number),
  check (total >= paid_amount)
);
create index supplier_bills_company_idx on public.supplier_bills (company_id, bill_date desc);
create index supplier_bills_supplier_idx on public.supplier_bills (supplier_id);
create index supplier_bills_status_idx on public.supplier_bills (company_id, status);
create trigger set_supplier_bills_updated_at before update on public.supplier_bills
  for each row execute function public.set_updated_at();
alter table public.supplier_bills enable row level security;

create table public.supplier_bill_items (
  id uuid primary key default gen_random_uuid(),
  supplier_bill_id uuid not null references public.supplier_bills(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(16, 2) not null default 0 check (unit_price >= 0),
  tax numeric(16, 2) not null default 0 check (tax >= 0),
  discount numeric(16, 2) not null default 0 check (discount >= 0),
  line_total numeric(16, 2) not null default 0 check (line_total >= 0),
  account_id uuid references public.chart_of_accounts(id),
  purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index supplier_bill_items_bill_idx on public.supplier_bill_items (supplier_bill_id);
alter table public.supplier_bill_items enable row level security;

create table public.supplier_bill_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_bill_id uuid not null references public.supplier_bills(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  approval_level int not null default 1,
  sequence int not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);
create index supplier_bill_approvals_bill_idx on public.supplier_bill_approvals (supplier_bill_id);
alter table public.supplier_bill_approvals enable row level security;

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_number text not null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  supplier_bill_id uuid not null references public.supplier_bills(id) on delete restrict,
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'OTHER')),
  bank_account_id uuid, -- FK added once `cash_accounts` exists
  currency_id uuid not null references public.currencies(id),
  amount numeric(16, 2) not null check (amount > 0),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),
  reference text,
  status text not null default 'COMPLETED' check (status in ('DRAFT', 'COMPLETED', 'VOID')),
  journal_entry_id uuid references public.journal_entries(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, payment_number)
);
create index supplier_payments_company_idx on public.supplier_payments (company_id, payment_date desc);
create index supplier_payments_bill_idx on public.supplier_payments (supplier_bill_id);
create trigger set_supplier_payments_updated_at before update on public.supplier_payments
  for each row execute function public.set_updated_at();
alter table public.supplier_payments enable row level security;
