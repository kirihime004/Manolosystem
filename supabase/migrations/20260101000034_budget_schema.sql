-- =========================================================================
-- PHASE 3: IT Budget schema
-- =========================================================================
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_name text not null,
  fiscal_year integer not null,
  start_date date not null,
  end_date date not null,
  currency_id uuid not null references public.currencies(id),
  total_budget numeric(16, 2) not null check (total_budget >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);

create index budgets_company_id_idx on public.budgets (company_id, fiscal_year desc);
create trigger set_budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();
alter table public.budgets enable row level security;

-- ---------------------------------------------------------------------
-- Categories: seeded defaults per company, companies can add their own.
-- ---------------------------------------------------------------------
create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create trigger set_budget_categories_updated_at before update on public.budget_categories
  for each row execute function public.set_updated_at();
alter table public.budget_categories enable row level security;

create or replace function public.seed_budget_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.budget_categories (company_id, name, is_system) values
    (new.id, 'Hardware', true),
    (new.id, 'Software', true),
    (new.id, 'Software Subscriptions', true),
    (new.id, 'Networking', true),
    (new.id, 'Servers', true),
    (new.id, 'Cloud Services', true),
    (new.id, 'Licensing', true),
    (new.id, 'Security', true),
    (new.id, 'Maintenance', true),
    (new.id, 'Repairs', true),
    (new.id, 'IT Services', true),
    (new.id, 'Consulting', true),
    (new.id, 'Training', true),
    (new.id, 'Telecommunications', true),
    (new.id, 'Other', true);
  return new;
end;
$$;

create trigger seed_budget_categories_trigger
  after insert on public.companies
  for each row execute function public.seed_budget_categories();

-- ---------------------------------------------------------------------
-- Allocation: how much of a budget's total is assigned to each category.
-- ---------------------------------------------------------------------
create table public.budget_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.budget_categories(id),
  allocated_amount numeric(16, 2) not null check (allocated_amount >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, category_id)
);

create trigger set_budget_allocations_updated_at before update on public.budget_allocations
  for each row execute function public.set_updated_at();
alter table public.budget_allocations enable row level security;

-- Total allocated across all categories can never exceed the budget's
-- total_budget -- enforced here, not just in the UI.
create or replace function public.check_budget_allocation_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
  v_other_allocated numeric;
begin
  select total_budget into v_total from public.budgets where id = new.budget_id;

  select coalesce(sum(allocated_amount), 0) into v_other_allocated
  from public.budget_allocations
  where budget_id = new.budget_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_other_allocated + new.allocated_amount > v_total then
    raise exception 'Allocation of % would exceed the budget total of %', new.allocated_amount, v_total;
  end if;

  return new;
end;
$$;

create trigger check_budget_allocation_limit_trigger
  before insert or update on public.budget_allocations
  for each row execute function public.check_budget_allocation_limit();

-- ---------------------------------------------------------------------
-- Transaction ledger. Budget totals (allocated/committed/spent/remaining/
-- available) are always DERIVED from this table (see v_budget_summary /
-- v_budget_category_summary below) -- nothing is stored/overwritten
-- directly, so the numbers can never drift out of sync with reality.
-- ---------------------------------------------------------------------
create table public.budget_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid references public.budget_categories(id),
  amount numeric(16, 2) not null check (amount >= 0),
  currency_id uuid not null references public.currencies(id),
  transaction_type text not null check (transaction_type in (
    'ALLOCATION', 'COMMITMENT', 'RELEASE', 'EXPENSE', 'ADJUSTMENT', 'REFUND'
  )),
  -- ADJUSTMENT is the one type that can move the Spent bucket in either
  -- direction (a correction); every other type's sign is implied by its
  -- transaction_type, so amount itself always stays non-negative above.
  adjustment_sign smallint not null default 1 check (adjustment_sign in (-1, 1)),
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index budget_transactions_budget_id_idx on public.budget_transactions (budget_id, created_at desc);
create index budget_transactions_category_idx on public.budget_transactions (budget_id, category_id);
create index budget_transactions_reference_idx on public.budget_transactions (reference_type, reference_id);
alter table public.budget_transactions enable row level security;

-- No client-facing write policy exists (see RLS migration) -- transactions
-- are only ever inserted by SECURITY DEFINER procurement/budget functions,
-- so "do not simply overwrite totals" is structural, not just a convention.

-- ---------------------------------------------------------------------
-- Summary views. security_invoker=true so they only ever see what the
-- querying user's own RLS already permits.
-- ---------------------------------------------------------------------
create view public.v_budget_summary
with (security_invoker = true)
as
select
  b.*,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'ALLOCATION'), 0) as allocated,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0) as committed,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
    + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0) as spent,
  b.total_budget
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as remaining,
  b.total_budget
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0)
      )
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as available
from public.budgets b
left join public.budget_transactions t on t.budget_id = b.id
group by b.id;

grant select on public.v_budget_summary to authenticated;

create view public.v_budget_category_summary
with (security_invoker = true)
as
select
  ba.budget_id,
  ba.category_id,
  bc.name as category_name,
  ba.allocated_amount,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0) as committed,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
    + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0) as spent,
  ba.allocated_amount
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0)
      )
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as available
from public.budget_allocations ba
join public.budget_categories bc on bc.id = ba.category_id
left join public.budget_transactions t on t.budget_id = ba.budget_id and t.category_id = ba.category_id
group by ba.budget_id, ba.category_id, bc.name, ba.allocated_amount;

grant select on public.v_budget_category_summary to authenticated;

-- ---------------------------------------------------------------------
-- Budget validation, called server-side before any commitment is allowed.
-- Converts p_amount (in p_currency_id) into the budget's own currency
-- using TODAY's rate for the check itself (the actual commitment, once
-- created, snapshots its own rate separately -- see procurement logic).
-- ---------------------------------------------------------------------
create or replace function public.check_budget_availability(
  p_budget_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_currency_id uuid
)
returns table (is_available boolean, available_amount numeric, converted_amount numeric)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_budget_currency uuid;
  v_rate numeric;
  v_converted numeric;
  v_available numeric;
begin
  select currency_id into v_budget_currency from public.budgets where id = p_budget_id;
  if v_budget_currency is null then
    raise exception 'Budget not found';
  end if;

  if p_currency_id = v_budget_currency then
    v_converted := p_amount;
  else
    v_rate := public.get_exchange_rate(p_currency_id, v_budget_currency);
    if v_rate is null then
      raise exception 'No exchange rate available to convert into the budget currency';
    end if;
    v_converted := round(p_amount * v_rate, 2);
  end if;

  if p_category_id is not null then
    select available into v_available from public.v_budget_category_summary
    where budget_id = p_budget_id and category_id = p_category_id;
  else
    select available into v_available from public.v_budget_summary where id = p_budget_id;
  end if;

  return query select coalesce(v_available, 0) >= v_converted, coalesce(v_available, 0), v_converted;
end;
$$;

grant execute on function public.check_budget_availability(uuid, uuid, numeric, uuid) to authenticated;
