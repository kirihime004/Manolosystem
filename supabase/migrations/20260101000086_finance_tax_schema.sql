-- =========================================================================
-- PHASE 5: Finance & Accounting -- Tax. Rates are effective-dated and
-- fully configurable -- nothing is hard-coded, per spec sections 40-42
-- (architected for BIR/VAT/withholding/EWT/compensation withholding, but
-- the actual percentages always come from this table, never from code).
-- =========================================================================
create table public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  rate numeric(6, 3) not null check (rate >= 0),
  tax_type text not null check (tax_type in ('VAT', 'WITHHOLDING_TAX', 'SALES_TAX', 'OTHER')),
  country text,
  effective_date date not null default current_date,
  expiry_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  check (expiry_date is null or expiry_date > effective_date)
);
create index tax_rates_company_idx on public.tax_rates (company_id, tax_type);
create trigger set_tax_rates_updated_at before update on public.tax_rates
  for each row execute function public.set_updated_at();
alter table public.tax_rates enable row level security;

-- Both bill/invoice items may optionally cite the specific rate a line's
-- tax amount was calculated from, for Tax Reporting to reconcile against.
alter table public.supplier_bill_items add column tax_rate_id uuid references public.tax_rates(id);
alter table public.customer_invoice_items add column tax_rate_id uuid references public.tax_rates(id);

create table public.tax_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reference_type text not null,
  reference_id uuid not null,
  tax_type text not null check (tax_type in ('VAT', 'WITHHOLDING_TAX', 'SALES_TAX', 'OTHER')),
  direction text not null check (direction in ('OUTPUT', 'INPUT')), -- OUTPUT = tax on sales (owed to authority), INPUT = tax on purchases (reclaimable)
  tax_rate_id uuid references public.tax_rates(id),
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  transaction_date date not null default current_date,
  base_amount numeric(16, 2) not null default 0,
  tax_amount numeric(16, 2) not null default 0,
  currency_id uuid not null references public.currencies(id),
  base_currency_id uuid references public.currencies(id),
  base_currency_tax_amount numeric(16, 2),
  created_at timestamptz not null default now()
);
create index tax_transactions_company_idx on public.tax_transactions (company_id, transaction_date desc);
create index tax_transactions_reference_idx on public.tax_transactions (reference_type, reference_id);
alter table public.tax_transactions enable row level security;
