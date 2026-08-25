-- =========================================================================
-- PHASE 6: Administration -- Maintenance for Admin-owned assets and
-- facilities (IT equipment maintenance stays under IT). Vehicles get their
-- own vehicle_maintenance table later (spec section 39 treats it as a
-- distinct log shape); this covers assets/rooms/locations generically.
-- =========================================================================
create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  maintenance_number text not null,
  asset_id uuid references public.admin_assets(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,

  reported_by uuid references public.employees(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,

  issue text not null,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status text not null default 'REPORTED' check (status in (
    'REPORTED', 'ASSESSED', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED'
  )),

  scheduled_date date,
  completed_date date,

  estimated_cost numeric(14, 2),
  actual_cost numeric(14, 2),
  currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, maintenance_number),
  check (asset_id is not null or room_id is not null or location_id is not null)
);

create index maintenance_records_company_idx on public.maintenance_records (company_id, status);
create index maintenance_records_asset_idx on public.maintenance_records (asset_id);

create trigger set_maintenance_records_updated_at
  before update on public.maintenance_records
  for each row execute function public.set_updated_at();

alter table public.maintenance_records enable row level security;

create or replace function public.before_insert_maintenance_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_currency_id uuid;
begin
  new.maintenance_number := public.generate_asset_code(new.company_id, 'MNT');

  if new.actual_cost is not null and new.currency_id is not null then
    select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = new.company_id;
    new.base_currency_id := v_base_currency_id;
    new.exchange_rate := case when new.currency_id = v_base_currency_id then 1
      else public.get_exchange_rate(new.currency_id, v_base_currency_id, current_date) end;
    new.base_currency_amount := case when new.exchange_rate is null then null else round(new.actual_cost * new.exchange_rate, 2) end;
  end if;

  return new;
end;
$$;

create trigger before_insert_maintenance_record_trigger
  before insert on public.maintenance_records
  for each row execute function public.before_insert_maintenance_record();

-- ---------------------------------------------------------------------
-- Preventive maintenance schedules -- recurring, distinct from the
-- reactive maintenance_records above.
-- ---------------------------------------------------------------------
create table public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  asset_id uuid references public.admin_assets(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  title text not null,
  frequency text not null check (frequency in ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM')),
  interval_days integer,
  last_maintenance_date date,
  next_maintenance_date date not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  estimated_cost numeric(14, 2),
  currency_id uuid references public.currencies(id),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (asset_id is not null or room_id is not null or location_id is not null),
  check (frequency <> 'CUSTOM' or interval_days is not null)
);

create index maintenance_schedules_next_idx on public.maintenance_schedules (company_id, next_maintenance_date) where is_active;

create trigger set_maintenance_schedules_updated_at
  before update on public.maintenance_schedules
  for each row execute function public.set_updated_at();

alter table public.maintenance_schedules enable row level security;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "maintenance_records_select" on public.maintenance_records
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.VIEW'));
create policy "maintenance_records_insert" on public.maintenance_records
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.CREATE'));
create policy "maintenance_records_update" on public.maintenance_records
  for update
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.MAINTENANCE.ASSIGN')
      or public.has_permission(company_id, 'ADMIN.MAINTENANCE.COMPLETE')
      or assigned_to = auth.uid()
    )
  )
  with check (public.has_company_access(company_id));
create policy "maintenance_records_delete" on public.maintenance_records
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.MAINTENANCE.CREATE') and status = 'REPORTED');

create policy "maintenance_schedules_select" on public.maintenance_schedules
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.VIEW'));
create policy "maintenance_schedules_insert" on public.maintenance_schedules
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.MAINTENANCE.CREATE'));
create policy "maintenance_schedules_update" on public.maintenance_schedules
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.MAINTENANCE.CREATE'))
  with check (public.has_company_access(company_id));
create policy "maintenance_schedules_delete" on public.maintenance_schedules
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.MAINTENANCE.CREATE'));
