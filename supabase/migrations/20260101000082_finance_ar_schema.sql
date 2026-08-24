-- =========================================================================
-- PHASE 5: Finance & Accounting -- Accounts Receivable. No existing
-- customer system was found anywhere in the codebase (confirmed by
-- inspection before writing this), so `customers` is genuinely new here --
-- not a duplicate of anything. project_id stays a bare uuid (no FK) on
-- both the invoice header and its line items, matching the deferred-FK
-- precedent for Phase 7 Production, which doesn't exist yet.
-- =========================================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_code text not null,
  name text not null,
  customer_type text not null default 'CLIENT' check (customer_type in (
    'CLIENT', 'STUDIO', 'NETWORK', 'PRODUCTION_COMPANY', 'CORPORATE', 'OTHER'
  )),
  contact_person text,
  email text,
  phone text,
  address text,
  tax_number text,
  currency_id uuid references public.currencies(id),
  payment_terms text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, customer_code)
);
create index customers_company_idx on public.customers (company_id, name);
create trigger set_customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
alter table public.customers enable row level security;

create or replace function public.before_insert_customer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.customer_code := public.generate_asset_code(new.company_id, 'CUST');
  return new;
end;
$$;

create trigger before_insert_customer_trigger
  before insert on public.customers
  for each row execute function public.before_insert_customer();

-- Attach the FK deferred from the journal engine migration, now that
-- customers exists.
alter table public.journal_entry_lines
  add constraint journal_entry_lines_customer_id_fkey
  foreign key (customer_id) references public.customers(id) on delete set null;

-- ---------------------------------------------------------------------
-- customer_invoices
-- ---------------------------------------------------------------------
create table public.customer_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  project_id uuid, -- no FK yet: Phase 7 Production doesn't exist
  invoice_date date not null default current_date,
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
    'DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED'
  )),
  department_id uuid references public.departments(id) on delete set null,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  profit_center_id uuid references public.profit_centers(id) on delete set null,
  payment_terms text,
  notes text,
  journal_entry_id uuid references public.journal_entries(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, invoice_number)
);
create index customer_invoices_company_idx on public.customer_invoices (company_id, invoice_date desc);
create index customer_invoices_customer_idx on public.customer_invoices (customer_id);
create index customer_invoices_status_idx on public.customer_invoices (company_id, status);
create trigger set_customer_invoices_updated_at before update on public.customer_invoices
  for each row execute function public.set_updated_at();
alter table public.customer_invoices enable row level security;

create table public.customer_invoice_items (
  id uuid primary key default gen_random_uuid(),
  customer_invoice_id uuid not null references public.customer_invoices(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(16, 2) not null default 0 check (unit_price >= 0),
  tax numeric(16, 2) not null default 0 check (tax >= 0),
  discount numeric(16, 2) not null default 0 check (discount >= 0),
  line_total numeric(16, 2) not null default 0 check (line_total >= 0),
  revenue_account_id uuid references public.chart_of_accounts(id),
  project_id uuid, -- no FK yet: Phase 7 Production doesn't exist
  created_at timestamptz not null default now()
);
create index customer_invoice_items_invoice_idx on public.customer_invoice_items (customer_invoice_id);
alter table public.customer_invoice_items enable row level security;

-- ---------------------------------------------------------------------
-- customer_payments -- unlike supplier_payments, overpayment is allowed
-- (spec explicitly supports it for AR: it becomes customer credit rather
-- than being rejected outright, the opposite of the AP overpayment guard).
-- ---------------------------------------------------------------------
create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  customer_invoice_id uuid not null references public.customer_invoices(id) on delete restrict,
  payment_date date not null default current_date,
  payment_method text not null check (payment_method in ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'OTHER')),
  bank_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  currency_id uuid not null references public.currencies(id),
  amount numeric(16, 2) not null check (amount > 0),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),
  is_overpayment boolean not null default false,
  reference text,
  status text not null default 'COMPLETED' check (status in ('DRAFT', 'COMPLETED', 'REFUNDED', 'VOID')),
  journal_entry_id uuid references public.journal_entries(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, payment_number)
);
create index customer_payments_company_idx on public.customer_payments (company_id, payment_date desc);
create index customer_payments_invoice_idx on public.customer_payments (customer_invoice_id);
create trigger set_customer_payments_updated_at before update on public.customer_payments
  for each row execute function public.set_updated_at();
alter table public.customer_payments enable row level security;
