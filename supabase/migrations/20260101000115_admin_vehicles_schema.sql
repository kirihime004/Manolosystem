-- =========================================================================
-- PHASE 6: Administration -- Vehicle fleet management.
-- =========================================================================
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vehicle_code text not null,
  plate_number text not null,
  make text,
  model text,
  year integer,
  vehicle_type text not null default 'OTHER' check (vehicle_type in (
    'COMPANY_CAR', 'VAN', 'TRUCK', 'MOTORCYCLE', 'PRODUCTION_TRANSPORT', 'SERVICE_VEHICLE', 'OTHER'
  )),
  color text,
  vin text,
  registration_number text,
  registration_expiry date,
  insurance_expiry date,
  assigned_driver uuid references public.employees(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  status text not null default 'AVAILABLE' check (status in (
    'AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'REPAIR', 'ACCIDENT', 'RETIRED', 'DISPOSED'
  )),
  purchase_date date,
  purchase_price numeric(14, 2),
  currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, vehicle_code),
  unique (company_id, plate_number)
);

create index vehicles_company_idx on public.vehicles (company_id, status);

create trigger set_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

alter table public.vehicles enable row level security;

create or replace function public.before_insert_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_currency_id uuid;
begin
  new.vehicle_code := public.generate_asset_code(new.company_id, 'VEH');

  if new.purchase_price is not null and new.currency_id is not null then
    select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = new.company_id;
    new.base_currency_id := v_base_currency_id;
    new.exchange_rate := case when new.currency_id = v_base_currency_id then 1
      else public.get_exchange_rate(new.currency_id, v_base_currency_id, coalesce(new.purchase_date, current_date)) end;
    new.base_currency_amount := case when new.exchange_rate is null then null else round(new.purchase_price * new.exchange_rate, 2) end;
  end if;

  if new.assigned_driver is not null and new.status = 'AVAILABLE' then
    new.status := 'ASSIGNED';
  end if;

  return new;
end;
$$;

create trigger before_insert_vehicle_trigger
  before insert on public.vehicles
  for each row execute function public.before_insert_vehicle();

-- ---------------------------------------------------------------------
-- Assignment history -- same shape as workspace_assignments.
-- ---------------------------------------------------------------------
create table public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  assigned_date date not null default current_date,
  returned_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RETURNED')),
  assigned_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (returned_date is null or returned_date >= assigned_date)
);

create index vehicle_assignments_vehicle_idx on public.vehicle_assignments (vehicle_id, status);

alter table public.vehicle_assignments enable row level security;

create or replace function public.derive_vehicle_assignment_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select v.company_id into new.company_id from public.vehicles v where v.id = new.vehicle_id;
  if new.company_id is null then raise exception 'Invalid vehicle_id'; end if;
  return new;
end;
$$;

create trigger derive_vehicle_assignment_company_id_trigger
  before insert or update on public.vehicle_assignments
  for each row execute function public.derive_vehicle_assignment_company_id();

-- ---------------------------------------------------------------------
-- Maintenance log -- distinct shape from the generic maintenance_records
-- table (spec section 39 treats vehicle service history as its own log:
-- oil change/service/repair/tires/inspection/registration/insurance, each
-- with mileage).
-- ---------------------------------------------------------------------
create table public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  maintenance_type text not null check (maintenance_type in (
    'OIL_CHANGE', 'SERVICE', 'REPAIR', 'TIRE_REPLACEMENT', 'INSPECTION', 'REGISTRATION', 'INSURANCE', 'OTHER'
  )),
  service_date date not null default current_date,
  mileage integer,
  cost numeric(14, 2),
  currency_id uuid references public.currencies(id),
  exchange_rate numeric(18, 6),
  base_currency_id uuid references public.currencies(id),
  base_currency_amount numeric(16, 2),
  supplier_id uuid references public.suppliers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index vehicle_maintenance_vehicle_idx on public.vehicle_maintenance (vehicle_id, service_date desc);

alter table public.vehicle_maintenance enable row level security;

create or replace function public.before_insert_vehicle_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_currency_id uuid;
  v_company_id uuid;
begin
  select company_id into v_company_id from public.vehicles where id = new.vehicle_id;
  if v_company_id is null then raise exception 'Invalid vehicle_id'; end if;
  new.company_id := v_company_id;

  if new.cost is not null and new.currency_id is not null then
    select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = new.company_id;
    new.base_currency_id := v_base_currency_id;
    new.exchange_rate := case when new.currency_id = v_base_currency_id then 1
      else public.get_exchange_rate(new.currency_id, v_base_currency_id, new.service_date) end;
    new.base_currency_amount := case when new.exchange_rate is null then null else round(new.cost * new.exchange_rate, 2) end;
  end if;

  return new;
end;
$$;

create trigger before_insert_vehicle_maintenance_trigger
  before insert on public.vehicle_maintenance
  for each row execute function public.before_insert_vehicle_maintenance();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "vehicles_select" on public.vehicles
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.VEHICLES.VIEW'));
create policy "vehicles_insert" on public.vehicles
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.VEHICLES.MANAGE'));
create policy "vehicles_update" on public.vehicles
  for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.VEHICLES.MANAGE') or public.has_permission(company_id, 'ADMIN.VEHICLES.ASSIGN')))
  with check (public.has_company_access(company_id));
create policy "vehicles_delete" on public.vehicles
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.VEHICLES.MANAGE'));

create policy "vehicle_assignments_select" on public.vehicle_assignments
  for select
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.VEHICLES.VIEW') or public.is_own_employee(employee_id)));
create policy "vehicle_assignments_insert" on public.vehicle_assignments
  for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.VEHICLES.ASSIGN'));
create policy "vehicle_assignments_update" on public.vehicle_assignments
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.VEHICLES.ASSIGN'))
  with check (public.has_company_access(company_id));

create policy "vehicle_maintenance_select" on public.vehicle_maintenance
  for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.VEHICLES.VIEW'));
create policy "vehicle_maintenance_insert" on public.vehicle_maintenance
  for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.VEHICLES.MANAGE'));
