-- =========================================================================
-- PHASE 6: Administration -- Locations, Buildings, Floors. Confirmed via
-- full-codebase research that no reusable location system exists anywhere
-- (every "location" reference elsewhere -- assets.location,
-- ip_addresses.location, employees.work_location -- is an independent
-- free-text column with no FK relationships). This is genuinely new,
-- shared infrastructure -- designed generic/reusable from the start so
-- Phase 7 Production can reference locations/buildings/floors/rooms later
-- without a rebuild (spec sections 94-95).
--
-- Also backfills the location_id FK on admin_requests, deferred from
-- migration 103 until this table exists.
-- =========================================================================
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text,
  type text not null default 'OTHER' check (type in (
    'HEAD_OFFICE', 'BRANCH', 'STUDIO', 'WAREHOUSE', 'REMOTE_OFFICE', 'OTHER'
  )),
  address text,
  city text,
  province text,
  country text,
  building text,
  floor text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  manager_id uuid references public.employees(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create trigger set_locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

alter table public.locations enable row level security;

-- ---------------------------------------------------------------------
-- Buildings within a location.
-- ---------------------------------------------------------------------
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  code text,
  address text,
  floors integer,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create trigger set_buildings_updated_at
  before update on public.buildings
  for each row execute function public.set_updated_at();

alter table public.buildings enable row level security;

create or replace function public.derive_building_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select l.company_id into new.company_id from public.locations l where l.id = new.location_id;
  if new.company_id is null then raise exception 'Invalid location_id'; end if;
  return new;
end;
$$;

create trigger derive_building_company_id_trigger
  before insert or update on public.buildings
  for each row execute function public.derive_building_company_id();

-- ---------------------------------------------------------------------
-- Floors within a building.
-- ---------------------------------------------------------------------
create table public.floors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  floor_number text not null,
  floor_name text,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, floor_number)
);

create trigger set_floors_updated_at
  before update on public.floors
  for each row execute function public.set_updated_at();

alter table public.floors enable row level security;

create or replace function public.derive_floor_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select b.company_id into new.company_id from public.buildings b where b.id = new.building_id;
  if new.company_id is null then raise exception 'Invalid building_id'; end if;
  return new;
end;
$$;

create trigger derive_floor_company_id_trigger
  before insert or update on public.floors
  for each row execute function public.derive_floor_company_id();

-- ---------------------------------------------------------------------
-- RLS -- view requires company access + ADMIN module + ADMIN.FACILITIES.VIEW
-- (or platform superadmin); writes require the matching CREATE/UPDATE/
-- MANAGE permission. Same three-table shape repeated for buildings/floors.
-- ---------------------------------------------------------------------
create policy "locations_select" on public.locations
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.FACILITIES.VIEW'));
create policy "locations_insert" on public.locations
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.FACILITIES.CREATE'));
create policy "locations_update" on public.locations
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.FACILITIES.UPDATE'))
  with check (public.has_company_access(company_id));
create policy "locations_delete" on public.locations
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.FACILITIES.MANAGE'));

create policy "buildings_select" on public.buildings
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.FACILITIES.VIEW'));
create policy "buildings_insert" on public.buildings
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.FACILITIES.CREATE'));
create policy "buildings_update" on public.buildings
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.FACILITIES.UPDATE'))
  with check (public.has_company_access(company_id));
create policy "buildings_delete" on public.buildings
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.FACILITIES.MANAGE'));

create policy "floors_select" on public.floors
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.FACILITIES.VIEW'));
create policy "floors_insert" on public.floors
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.FACILITIES.CREATE'));
create policy "floors_update" on public.floors
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.FACILITIES.UPDATE'))
  with check (public.has_company_access(company_id));
create policy "floors_delete" on public.floors
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.FACILITIES.MANAGE'));

-- ---------------------------------------------------------------------
-- Now that locations exists, wire up the FK deferred from migration 103.
-- ---------------------------------------------------------------------
alter table public.admin_requests
  add constraint admin_requests_location_id_fkey foreign key (location_id) references public.locations(id) on delete set null;
