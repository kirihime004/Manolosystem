-- =========================================================================
-- PHASE 6: Administration -- Rooms + Room Booking. Booking overlap is
-- enforced server-side by a trigger (not just app-layer validation),
-- mirroring the validation-trigger convention used elsewhere in this
-- codebase (e.g. check_department_hierarchy_trigger, validate_employee_trigger)
-- rather than reaching for a GiST exclusion constraint the rest of the
-- schema doesn't otherwise use.
-- =========================================================================
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  building_id uuid references public.buildings(id) on delete set null,
  floor_id uuid references public.floors(id) on delete set null,
  room_code text not null,
  name text not null,
  room_number text,
  type text not null default 'OTHER' check (type in (
    'MEETING_ROOM', 'CONFERENCE_ROOM', 'TRAINING_ROOM', 'STUDIO', 'OFFICE',
    'RECEPTION', 'KITCHEN', 'STORAGE', 'OTHER'
  )),
  capacity integer,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, room_code)
);

create index rooms_company_idx on public.rooms (company_id, status);

create trigger set_rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

create or replace function public.before_insert_room()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.room_code := public.generate_asset_code(new.company_id, 'RM');
  return new;
end;
$$;

create trigger before_insert_room_trigger
  before insert on public.rooms
  for each row execute function public.before_insert_room();

-- ---------------------------------------------------------------------
-- Room bookings.
-- ---------------------------------------------------------------------
create table public.room_bookings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  requester_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  purpose text,
  attendees integer,
  status text not null default 'REQUESTED' check (status in (
    'REQUESTED', 'APPROVED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index room_bookings_room_date_idx on public.room_bookings (room_id, booking_date);

create trigger set_room_bookings_updated_at
  before update on public.room_bookings
  for each row execute function public.set_updated_at();

alter table public.room_bookings enable row level security;

create or replace function public.derive_room_booking_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select r.company_id into new.company_id from public.rooms r where r.id = new.room_id;
  if new.company_id is null then raise exception 'Invalid room_id'; end if;
  return new;
end;
$$;

create trigger derive_room_booking_company_id_trigger
  before insert or update on public.room_bookings
  for each row execute function public.derive_room_booking_company_id();

-- Prevent overlapping active bookings for the same room. Only
-- REQUESTED/APPROVED/CONFIRMED bookings block a slot -- a CANCELLED or
-- COMPLETED booking never does.
create or replace function public.prevent_overlapping_room_booking()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status not in ('REQUESTED', 'APPROVED', 'CONFIRMED') then
    return new;
  end if;

  if exists (
    select 1 from public.room_bookings b
    where b.room_id = new.room_id
      and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and b.booking_date = new.booking_date
      and b.status in ('REQUESTED', 'APPROVED', 'CONFIRMED')
      and new.start_time < b.end_time
      and new.end_time > b.start_time
  ) then
    raise exception 'This room is already booked for an overlapping time on %', new.booking_date;
  end if;

  return new;
end;
$$;

create trigger prevent_overlapping_room_booking_trigger
  before insert or update on public.room_bookings
  for each row execute function public.prevent_overlapping_room_booking();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "rooms_select" on public.rooms
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.ROOMS.VIEW'));
create policy "rooms_insert" on public.rooms
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.ROOMS.CREATE'));
create policy "rooms_update" on public.rooms
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.ROOMS.CREATE'))
  with check (public.has_company_access(company_id));
create policy "rooms_delete" on public.rooms
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.FACILITIES.MANAGE'));

create policy "room_bookings_select" on public.room_bookings
  for select
  using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'ADMIN.ROOMS.VIEW') or public.is_own_employee(requester_id))
  );
create policy "room_bookings_insert" on public.room_bookings
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.ROOMS.BOOK') or public.is_own_employee(requester_id))
  );
create policy "room_bookings_update" on public.room_bookings
  for update
  using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'ADMIN.ROOMS.CREATE') or (public.is_own_employee(requester_id) and status = 'REQUESTED'))
  )
  with check (public.has_company_access(company_id));
create policy "room_bookings_delete" on public.room_bookings
  for delete
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.ROOMS.CREATE') or public.is_own_employee(requester_id)));
