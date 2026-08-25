-- =========================================================================
-- PHASE 6: Administration -- Office Supplies. Confirmed via research that
-- Phase 2 Inventory has no quantity-tracking concept anywhere (assets is
-- strictly one-row-per-serialized-item) -- this is genuinely new schema,
-- not an extension of assets. IT Inventory remains untouched; this is a
-- separate quantity-tracked ledger scoped to module=ADMIN, inventory_type
-- =OFFICE_SUPPLY only in spirit (there's nothing to extend).
--
-- current_quantity is a live column for fast reads, exactly like
-- workspaces.status/assets.status -- it is NEVER written directly except
-- by record_supply_movement() below, which is the single choke point that
-- also appends to office_supply_movements. Never silently overwritten.
-- =========================================================================
create table public.office_supplies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_code text not null,
  name text not null,
  category text,
  unit text not null default 'each',
  current_quantity numeric(12, 2) not null default 0,
  minimum_quantity numeric(12, 2) not null default 0,
  reorder_quantity numeric(12, 2),
  location_id uuid references public.locations(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  unit_cost numeric(12, 2),
  currency_id uuid references public.currencies(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISCONTINUED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, item_code),
  check (current_quantity >= 0)
);

create index office_supplies_company_idx on public.office_supplies (company_id, status);

create trigger set_office_supplies_updated_at
  before update on public.office_supplies
  for each row execute function public.set_updated_at();

alter table public.office_supplies enable row level security;

create or replace function public.before_insert_office_supply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.item_code := public.generate_asset_code(new.company_id, 'SUP');
  return new;
end;
$$;

create trigger before_insert_office_supply_trigger
  before insert on public.office_supplies
  for each row execute function public.before_insert_office_supply();

-- ---------------------------------------------------------------------
-- Movements -- append-only ledger, one row per stock event.
-- ---------------------------------------------------------------------
create table public.office_supply_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supply_id uuid not null references public.office_supplies(id) on delete cascade,
  movement_type text not null check (movement_type in (
    'STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT', 'RETURN', 'DISPOSAL'
  )),
  quantity numeric(12, 2) not null check (quantity <> 0),
  previous_quantity numeric(12, 2) not null,
  new_quantity numeric(12, 2) not null,
  reference_type text,
  reference_id uuid,
  performed_by uuid references auth.users(id) on delete set null,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);

create index office_supply_movements_supply_idx on public.office_supply_movements (supply_id, created_at desc);

alter table public.office_supply_movements enable row level security;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "office_supplies_select" on public.office_supplies
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.SUPPLIES.VIEW'));
create policy "office_supplies_insert" on public.office_supplies
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.SUPPLIES.MANAGE'));
create policy "office_supplies_update" on public.office_supplies
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.SUPPLIES.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "office_supplies_delete" on public.office_supplies
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.SUPPLIES.MANAGE'));

create policy "office_supply_movements_select" on public.office_supply_movements
  for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.SUPPLIES.VIEW'));
