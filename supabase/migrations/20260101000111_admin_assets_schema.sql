-- =========================================================================
-- PHASE 6: Administration -- Administrative Assets (furniture, appliances,
-- non-IT equipment). The spec's own preference (section 26) is to extend
-- Phase 2's `assets` table via its asset_type enum rather than build a
-- second engine. That was evaluated and rejected: `assets`' RLS
-- (assets_select/insert/update/delete, 20260101000027) and its
-- before_insert_asset()/before_update_asset() triggers are hard-wired to
-- IT.INVENTORY.* permissions with no per-row module/department
-- discriminator today. Extending the enum without also rewriting those
-- live, already-tested IT policies would mean either IT staff gaining
-- write access to Admin's chairs/desks, or Admin staff being unable to
-- create/view their own assets at all -- exactly the department-boundary
-- violation the spec itself calls out in section 102 TEST 5 ("Admin
-- attempts to modify IT asset ownership -> DENIED or routed through IT").
--
-- So: the *table* is new, but every *convention* is reused verbatim --
-- generate_asset_code() numbering, the Phase 3 currency quadruple, Phase 4
-- employee/department FKs, and the shared admin_history table in place of
-- a second asset_history clone. This mirrors exactly how office_supplies
-- (migration 108) was already justified as new schema, for the same reason.
-- =========================================================================
create table public.admin_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_code text not null,
  name text not null,
  category text,
  brand text,
  model text,
  serial_number text,
  status text not null default 'AVAILABLE' check (status in (
    'ACTIVE', 'AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DAMAGED', 'LOST', 'DISPOSED', 'RETIRED'
  )),
  condition text check (condition in ('NEW', 'GOOD', 'FAIR', 'POOR', 'DEFECTIVE', 'NON_FUNCTIONAL')),

  purchase_date date,
  purchase_price numeric(14, 2),
  currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),
  supplier_id uuid references public.suppliers(id) on delete set null,

  warranty_start date,
  warranty_end date,

  location_id uuid references public.locations(id) on delete set null,
  assigned_to uuid references public.employees(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,

  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, asset_code)
);

create index admin_assets_company_idx on public.admin_assets (company_id, status);
create index admin_assets_assigned_idx on public.admin_assets (assigned_to);

create trigger set_admin_assets_updated_at
  before update on public.admin_assets
  for each row execute function public.set_updated_at();

alter table public.admin_assets enable row level security;

create or replace function public.before_insert_admin_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_currency_id uuid;
begin
  new.asset_code := public.generate_asset_code(new.company_id, 'ADAS');
  new.created_by := auth.uid();

  if new.assigned_to is not null and new.status = 'AVAILABLE' then
    new.status := 'ASSIGNED';
  end if;

  if new.purchase_price is not null and new.currency_id is not null then
    select base_currency_id into v_base_currency_id
    from public.company_currency_settings where company_id = new.company_id;

    new.base_currency_id := v_base_currency_id;
    new.exchange_rate := case
      when new.currency_id = v_base_currency_id then 1
      else public.get_exchange_rate(new.currency_id, v_base_currency_id, coalesce(new.purchase_date, current_date))
    end;
    new.base_currency_amount := case
      when new.exchange_rate is null then null
      else round(new.purchase_price * new.exchange_rate, 2)
    end;
  end if;

  return new;
end;
$$;

create trigger before_insert_admin_asset_trigger
  before insert on public.admin_assets
  for each row execute function public.before_insert_admin_asset();

create or replace function public.after_insert_admin_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_admin_event(new.company_id, 'ADMIN_ASSET', new.id, 'CREATED', null, new.status,
    jsonb_build_object('asset_code', new.asset_code, 'name', new.name));
  if new.assigned_to is not null then
    perform public.log_admin_event(new.company_id, 'ADMIN_ASSET', new.id, 'ASSIGNED', null, new.status,
      jsonb_build_object('assigned_to', new.assigned_to));
  end if;
  return new;
end;
$$;

create trigger after_insert_admin_asset_trigger
  after insert on public.admin_assets
  for each row execute function public.after_insert_admin_asset();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "admin_assets_select" on public.admin_assets
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.ASSETS.VIEW') or public.is_own_employee(assigned_to))
  );
create policy "admin_assets_insert" on public.admin_assets
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.ASSETS.CREATE'));
create policy "admin_assets_update" on public.admin_assets
  for update
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.ASSETS.UPDATE')
      or public.has_permission(company_id, 'ADMIN.ASSETS.ASSIGN')
      or public.has_permission(company_id, 'ADMIN.ASSETS.DISPOSE')
    )
  )
  with check (public.has_company_access(company_id));
create policy "admin_assets_delete" on public.admin_assets
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.ASSETS.DISPOSE'));
