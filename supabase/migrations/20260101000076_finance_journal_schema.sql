-- =========================================================================
-- PHASE 5: Finance & Accounting -- the double-entry journal engine schema.
-- journal_entries is the header/status record; journal_entry_lines carries
-- the actual debit/credit lines plus every financial dimension (spec
-- section 57). customer_id is a bare uuid for now -- customers doesn't
-- exist until the AR migration -- and gets its FK attached there, the same
-- deferred-FK approach already established for project_id (Phase 7
-- Production doesn't exist yet either, matching the timesheets.project_id
-- precedent from Phase 4).
-- =========================================================================
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  journal_number text not null,
  date date not null default current_date,
  reference_type text,
  reference_id uuid,
  description text not null,
  currency_id uuid not null references public.currencies(id),
  exchange_rate numeric(18, 6) not null default 1,
  base_currency_id uuid not null references public.currencies(id),
  financial_period_id uuid references public.financial_periods(id),
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REVERSED', 'VOID'
  )),
  -- Denormalized line totals, maintained by a trigger on journal_entry_lines,
  -- so the balance can be checked/displayed without re-aggregating lines.
  total_debit numeric(16, 2) not null default 0,
  total_credit numeric(16, 2) not null default 0,
  reversal_of_id uuid references public.journal_entries(id),
  reversal_reason text,
  created_by uuid references auth.users(id) on delete set null,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, journal_number)
);
create index journal_entries_company_idx on public.journal_entries (company_id, date desc);
create index journal_entries_status_idx on public.journal_entries (company_id, status);
create index journal_entries_reference_idx on public.journal_entries (reference_type, reference_id);
create trigger set_journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();
alter table public.journal_entries enable row level security;

create or replace function public.before_insert_journal_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.journal_number := public.generate_asset_code(new.company_id, 'JE');
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger before_insert_journal_entry_trigger
  before insert on public.journal_entries
  for each row execute function public.before_insert_journal_entry();

-- ---------------------------------------------------------------------
-- journal_entry_lines
-- ---------------------------------------------------------------------
create table public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  line_number int not null default 1,
  account_id uuid not null references public.chart_of_accounts(id),
  description text,
  -- Line amount in the journal's own currency (matches journal_entries.currency_id).
  debit numeric(16, 2) not null default 0 check (debit >= 0),
  credit numeric(16, 2) not null default 0 check (credit >= 0),
  original_amount numeric(16, 2),
  exchange_rate numeric(18, 6),
  -- Base-currency amounts, snapshotted at post time -- what the GL/TB/reports
  -- actually sum, so foreign-currency journals never drift as rates change.
  base_debit numeric(16, 2) not null default 0 check (base_debit >= 0),
  base_credit numeric(16, 2) not null default 0 check (base_credit >= 0),
  -- Financial dimensions (spec section 57). All optional; supplier/customer
  -- FKs point at existing shared master tables, never new ones.
  department_id uuid references public.departments(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  customer_id uuid, -- FK added once `customers` exists (AR migration)
  project_id uuid,  -- no FK yet: Phase 7 Production doesn't exist
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  profit_center_id uuid references public.profit_centers(id) on delete set null,
  created_at timestamptz not null default now(),
  check (not (debit > 0 and credit > 0)),
  check (debit > 0 or credit > 0)
);
create index journal_entry_lines_entry_idx on public.journal_entry_lines (journal_entry_id);
create index journal_entry_lines_account_idx on public.journal_entry_lines (account_id);
create index journal_entry_lines_company_idx on public.journal_entry_lines (company_id);
create index journal_entry_lines_dimensions_idx on public.journal_entry_lines
  (department_id, cost_center_id, profit_center_id, employee_id, supplier_id, customer_id);
alter table public.journal_entry_lines enable row level security;

-- Never trust a client-supplied company_id: derive it from the parent
-- journal entry, exactly like every Phase 4 child-table pattern.
create or replace function public.before_insert_journal_entry_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.journal_entries where id = new.journal_entry_id;
  return new;
end;
$$;

create trigger before_insert_journal_entry_line_trigger
  before insert on public.journal_entry_lines
  for each row execute function public.before_insert_journal_entry_line();

-- Keep journal_entries.total_debit/total_credit in sync with its lines.
create or replace function public.after_write_journal_entry_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_journal_entry_id uuid := coalesce(new.journal_entry_id, old.journal_entry_id);
begin
  update public.journal_entries je
  set total_debit = coalesce((select sum(base_debit) from public.journal_entry_lines where journal_entry_id = v_journal_entry_id), 0),
      total_credit = coalesce((select sum(base_credit) from public.journal_entry_lines where journal_entry_id = v_journal_entry_id), 0)
  where je.id = v_journal_entry_id;
  return null;
end;
$$;

create trigger after_write_journal_entry_line_trigger
  after insert or update or delete on public.journal_entry_lines
  for each row execute function public.after_write_journal_entry_line();
