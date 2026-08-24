-- =========================================================================
-- PHASE 5: Finance & Accounting -- Cash & Bank. Built before the rest of
-- AP/AR logic so supplier/customer payments can post against a real
-- cash_accounts row (and its linked GL account) from the start, instead of
-- a deferred-FK stub. Never stores bank passwords/PINs/online-banking
-- credentials -- only the masked account number needed to identify the
-- account on statements.
-- =========================================================================
create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('BANK', 'CASH', 'PETTY_CASH', 'CREDIT_CARD', 'OTHER')),
  bank_name text,
  account_number_masked text,
  currency_id uuid not null references public.currencies(id),
  gl_account_id uuid not null references public.chart_of_accounts(id),
  opening_balance numeric(16, 2) not null default 0,
  current_balance numeric(16, 2) not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cash_accounts_company_idx on public.cash_accounts (company_id);
create trigger set_cash_accounts_updated_at before update on public.cash_accounts
  for each row execute function public.set_updated_at();
alter table public.cash_accounts enable row level security;

create or replace function public.before_insert_cash_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.current_balance := new.opening_balance;
  return new;
end;
$$;

create trigger before_insert_cash_account_trigger
  before insert on public.cash_accounts
  for each row execute function public.before_insert_cash_account();

-- ---------------------------------------------------------------------
-- bank_transactions -- append-only ledger per cash account. Corrections
-- are new offsetting ADJUSTMENT rows, never edits, per spec section 38
-- ("never silently modify accounting records").
-- ---------------------------------------------------------------------
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cash_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in (
    'DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'BANK_FEE', 'INTEREST', 'ADJUSTMENT'
  )),
  direction text not null check (direction in ('IN', 'OUT')),
  reference text,
  description text,
  amount numeric(16, 2) not null check (amount > 0),
  currency_id uuid not null references public.currencies(id),
  reconciled boolean not null default false,
  reconciliation_id uuid,
  reference_type text,
  reference_id uuid,
  journal_entry_id uuid references public.journal_entries(id),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bank_transactions_account_idx on public.bank_transactions (cash_account_id, transaction_date desc);
create index bank_transactions_company_idx on public.bank_transactions (company_id);
create index bank_transactions_unreconciled_idx on public.bank_transactions (cash_account_id) where not reconciled;
create trigger set_bank_transactions_updated_at before update on public.bank_transactions
  for each row execute function public.set_updated_at();
alter table public.bank_transactions enable row level security;

create or replace function public.before_insert_bank_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_bank_transaction_trigger
  before insert on public.bank_transactions
  for each row execute function public.before_insert_bank_transaction();

-- Only reconciliation bookkeeping fields may ever change after creation;
-- the financial facts of a bank transaction are immutable.
create or replace function public.before_update_bank_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.cash_account_id, new.transaction_type, new.direction, new.amount, new.currency_id, new.transaction_date)
     is distinct from
     (old.cash_account_id, old.transaction_type, old.direction, old.amount, old.currency_id, old.transaction_date) then
    raise exception 'Bank transactions are immutable once recorded. Record an offsetting ADJUSTMENT instead.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_bank_transaction_trigger
  before update on public.bank_transactions
  for each row execute function public.before_update_bank_transaction();

create or replace function public.after_write_bank_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cash_account_id uuid := coalesce(new.cash_account_id, old.cash_account_id);
begin
  update public.cash_accounts ca
  set current_balance = ca.opening_balance
    + coalesce((select sum(amount) from public.bank_transactions where cash_account_id = v_cash_account_id and direction = 'IN'), 0)
    - coalesce((select sum(amount) from public.bank_transactions where cash_account_id = v_cash_account_id and direction = 'OUT'), 0)
  where ca.id = v_cash_account_id;
  return null;
end;
$$;

create trigger after_write_bank_transaction_trigger
  after insert or update or delete on public.bank_transactions
  for each row execute function public.after_write_bank_transaction();

-- ---------------------------------------------------------------------
-- bank_reconciliations -- one row per reconciliation session.
-- ---------------------------------------------------------------------
create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  cash_account_id uuid not null references public.cash_accounts(id) on delete restrict,
  statement_date date not null,
  statement_balance numeric(16, 2) not null,
  system_balance numeric(16, 2) not null,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  notes text,
  reconciled_by uuid references auth.users(id) on delete set null,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bank_reconciliations_account_idx on public.bank_reconciliations (cash_account_id, statement_date desc);
create trigger set_bank_reconciliations_updated_at before update on public.bank_reconciliations
  for each row execute function public.set_updated_at();
alter table public.bank_reconciliations enable row level security;

alter table public.bank_transactions
  add constraint bank_transactions_reconciliation_id_fkey
  foreign key (reconciliation_id) references public.bank_reconciliations(id) on delete set null;

-- Attach the FK deferred from the AP migration, now that cash_accounts exists.
alter table public.supplier_payments
  add constraint supplier_payments_bank_account_id_fkey
  foreign key (bank_account_id) references public.cash_accounts(id) on delete restrict;

