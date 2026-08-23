-- =========================================================================
-- PHASE 4: Organization structure -- extends the existing `departments`
-- table (created in Phase 1, migration 005) rather than duplicating it,
-- and adds `positions`. manager_id on departments references employees,
-- so its FK constraint is added in 051_hr_employee_schema once that table
-- exists; it's a plain nullable uuid here.
-- =========================================================================
alter table public.departments
  add column code text,
  add column manager_id uuid,
  add column parent_department_id uuid references public.departments(id) on delete set null,
  add column status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE'));

create index departments_parent_idx on public.departments (parent_department_id);

-- Prevent a department from being its own ancestor.
create or replace function public.check_department_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current uuid;
  v_depth integer := 0;
begin
  if new.parent_department_id is null then
    return new;
  end if;
  if new.parent_department_id = new.id then
    raise exception 'A department cannot be its own parent';
  end if;
  v_current := new.parent_department_id;
  while v_current is not null and v_depth < 50 loop
    if v_current = new.id then
      raise exception 'Department hierarchy cannot contain a cycle';
    end if;
    select parent_department_id into v_current from public.departments where id = v_current;
    v_depth := v_depth + 1;
  end loop;
  return new;
end;
$$;

create trigger check_department_hierarchy_trigger
  before insert or update of parent_department_id on public.departments
  for each row execute function public.check_department_hierarchy();

-- ---------------------------------------------------------------------
-- positions
-- ---------------------------------------------------------------------
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  code text,
  department_id uuid references public.departments(id) on delete set null,
  level integer,
  description text,
  reports_to_position_id uuid references public.positions(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, title)
);

create index positions_department_idx on public.positions (department_id);
create trigger set_positions_updated_at before update on public.positions
  for each row execute function public.set_updated_at();
alter table public.positions enable row level security;
