-- =========================================================================
-- PHASE 4: The employee master record -- the single identity every other
-- department (IT, Finance, Admin, Production) references instead of
-- creating its own employee table. employee_number is generated the same
-- safe, atomic way as HW-/PR-/PO- codes (generate_asset_code(), Phase 2),
-- never trusted from the client.
-- =========================================================================
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_number text not null,

  -- Related but separate from a MindBurst login: an employee can exist
  -- purely as an HR record with no system access at all.
  user_id uuid references auth.users(id) on delete set null,

  first_name text not null,
  middle_name text,
  last_name text not null,
  preferred_name text,
  date_of_birth date,
  gender text,
  nationality text,
  marital_status text,

  personal_email text,
  company_email text,
  phone text,
  alternative_phone text,
  address text,
  city text,
  province text,
  country text,
  profile_photo_path text,

  department_id uuid references public.departments(id) on delete set null,
  position_id uuid references public.positions(id) on delete set null,
  manager_id uuid references public.employees(id) on delete set null,
  supervisor_id uuid references public.employees(id) on delete set null,

  employment_type_id uuid references public.employment_types(id) on delete set null,
  employment_status_id uuid references public.employment_statuses(id) on delete set null,
  employee_category text,

  hire_date date,
  probation_start_date date,
  probation_end_date date,
  regularization_date date,
  termination_date date,
  work_location text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_number)
);

create unique index employees_company_email_unique_idx
  on public.employees (company_id, lower(company_email)) where company_email is not null;
create index employees_company_idx on public.employees (company_id);
create index employees_department_idx on public.employees (department_id);
create index employees_manager_idx on public.employees (manager_id);
create index employees_user_idx on public.employees (user_id);

create trigger set_employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();
alter table public.employees enable row level security;

-- Departments' manager_id can now point at a real employee.
alter table public.departments
  add constraint departments_manager_id_fkey foreign key (manager_id) references public.employees(id) on delete set null;

-- ---------------------------------------------------------------------
-- Validation: dates must be internally consistent; an employee cannot
-- manage/supervise themselves.
-- ---------------------------------------------------------------------
create or replace function public.validate_employee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.manager_id = new.id then raise exception 'An employee cannot be their own manager'; end if;
  if new.supervisor_id = new.id then raise exception 'An employee cannot be their own supervisor'; end if;
  if new.termination_date is not null and new.hire_date is not null and new.termination_date < new.hire_date then
    raise exception 'Termination date cannot be before hire date';
  end if;
  if new.probation_end_date is not null and new.probation_start_date is not null and new.probation_end_date < new.probation_start_date then
    raise exception 'Probation end date cannot be before probation start date';
  end if;
  if new.company_email is not null and new.company_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid company email address';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_employee_trigger
  before insert or update on public.employees
  for each row execute function public.validate_employee();

create or replace function public.before_insert_employee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.employee_number is null or new.employee_number = '' then
    new.employee_number := public.generate_asset_code(new.company_id, 'EMP');
  end if;
  return new;
end;
$$;

create trigger before_insert_employee_trigger
  before insert on public.employees
  for each row execute function public.before_insert_employee();

-- ---------------------------------------------------------------------
-- Emergency contacts -- an employee may have several; exactly one may be
-- flagged primary.
-- ---------------------------------------------------------------------
create table public.employee_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  address text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index employee_emergency_contacts_one_primary_idx
  on public.employee_emergency_contacts (employee_id) where is_primary;
create index employee_emergency_contacts_employee_idx on public.employee_emergency_contacts (employee_id);
create trigger set_employee_emergency_contacts_updated_at before update on public.employee_emergency_contacts
  for each row execute function public.set_updated_at();
alter table public.employee_emergency_contacts enable row level security;

create or replace function public.before_write_employee_emergency_contact()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.employees where id = new.employee_id;
  if new.company_id is null then raise exception 'Invalid employee_id'; end if;
  return new;
end;
$$;

create trigger before_write_employee_emergency_contact_trigger
  before insert or update on public.employee_emergency_contacts
  for each row execute function public.before_write_employee_emergency_contact();

-- ---------------------------------------------------------------------
-- Employee history -- append-only lifecycle timeline. Never overwritten;
-- RLS below (063) grants insert/select only, no update/delete.
-- ---------------------------------------------------------------------
create table public.employee_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type text not null,
  field_name text,
  previous_value text,
  new_value text,
  reason text,
  notes text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index employee_history_employee_idx on public.employee_history (employee_id, created_at desc);
alter table public.employee_history enable row level security;

create or replace function public.log_employee_event(
  p_company_id uuid, p_employee_id uuid, p_event_type text,
  p_field_name text default null, p_previous_value text default null, p_new_value text default null,
  p_reason text default null, p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.employee_history (company_id, employee_id, event_type, field_name, previous_value, new_value, reason, notes, performed_by)
  values (p_company_id, p_employee_id, p_event_type, p_field_name, p_previous_value, p_new_value, p_reason, p_notes, auth.uid());
end;
$$;

-- Record creation automatically; field-level changes (department, position,
-- manager, status) are logged explicitly by the application via
-- log_employee_event() so the reason/notes the user typed travels with them.
create or replace function public.after_insert_employee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_employee_event(new.company_id, new.id, 'EMPLOYEE_CREATED', null, null, new.employee_number);
  perform public.log_audit_event(new.company_id, 'EMPLOYEE_CREATED', 'employee', new.id, jsonb_build_object('employee_number', new.employee_number));
  return new;
end;
$$;

create trigger after_insert_employee_trigger
  after insert on public.employees
  for each row execute function public.after_insert_employee();
