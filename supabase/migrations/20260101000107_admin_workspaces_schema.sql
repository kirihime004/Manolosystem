-- =========================================================================
-- PHASE 6: Administration -- Workspace management. Assignment follows the
-- exact same shape as IT asset assignment (20260101000024/026): a live
-- current-state column on the workspace row (status + current_employee_id)
-- for fast lookups, plus an append-only workspace_assignments ledger that
-- is NEVER deleted when an employee changes department or leaves (spec
-- section 15 is explicit about preserving assignment history).
-- =========================================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  building_id uuid references public.buildings(id) on delete set null,
  floor_id uuid references public.floors(id) on delete set null,
  workspace_code text not null,
  area text,
  desk_number text,
  status text not null default 'AVAILABLE' check (status in (
    'AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'UNAVAILABLE'
  )),
  current_employee_id uuid references public.employees(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, workspace_code)
);

create index workspaces_company_idx on public.workspaces (company_id, status);

create trigger set_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;

create or replace function public.before_insert_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.workspace_code := public.generate_asset_code(new.company_id, 'WS');
  return new;
end;
$$;

create trigger before_insert_workspace_trigger
  before insert on public.workspaces
  for each row execute function public.before_insert_workspace();

-- ---------------------------------------------------------------------
-- Assignment ledger -- append-only, one row per assignment period.
-- released_date is null while the assignment is current.
-- ---------------------------------------------------------------------
create table public.workspace_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  assigned_date date not null default current_date,
  released_date date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'RELEASED')),
  assigned_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (released_date is null or released_date >= assigned_date)
);

create index workspace_assignments_workspace_idx on public.workspace_assignments (workspace_id, status);
create index workspace_assignments_employee_idx on public.workspace_assignments (employee_id);

alter table public.workspace_assignments enable row level security;

create or replace function public.derive_workspace_assignment_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select w.company_id into new.company_id from public.workspaces w where w.id = new.workspace_id;
  if new.company_id is null then raise exception 'Invalid workspace_id'; end if;
  return new;
end;
$$;

create trigger derive_workspace_assignment_company_id_trigger
  before insert or update on public.workspace_assignments
  for each row execute function public.derive_workspace_assignment_company_id();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
create policy "workspaces_select" on public.workspaces
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.WORKSPACES.VIEW'));
create policy "workspaces_insert" on public.workspaces
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.WORKSPACES.MANAGE'));
create policy "workspaces_update" on public.workspaces
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.WORKSPACES.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "workspaces_delete" on public.workspaces
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.WORKSPACES.MANAGE'));

create policy "workspace_assignments_select" on public.workspace_assignments
  for select
  using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'ADMIN.WORKSPACES.VIEW') or public.is_own_employee(employee_id))
  );
create policy "workspace_assignments_insert" on public.workspace_assignments
  for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.WORKSPACES.MANAGE'));
create policy "workspace_assignments_update" on public.workspace_assignments
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.WORKSPACES.MANAGE'))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- assign_workspace / release_workspace -- mirrors reassign_asset()'s
-- reason-capturing shape.
-- ---------------------------------------------------------------------
create or replace function public.assign_workspace(
  p_workspace_id uuid, p_employee_id uuid, p_department_id uuid default null, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.workspaces;
  v_assignment_id uuid;
begin
  select * into v_workspace from public.workspaces where id = p_workspace_id for update;
  if v_workspace is null then raise exception 'Workspace not found'; end if;
  if not public.has_permission(v_workspace.company_id, 'ADMIN.WORKSPACES.MANAGE') then raise exception 'Access denied'; end if;
  if v_workspace.status not in ('AVAILABLE', 'RESERVED') then
    raise exception 'Workspace is not available for assignment';
  end if;

  insert into public.workspace_assignments (company_id, workspace_id, employee_id, department_id, assigned_by, notes)
  values (v_workspace.company_id, p_workspace_id, p_employee_id, p_department_id, auth.uid(), p_notes)
  returning id into v_assignment_id;

  update public.workspaces set status = 'OCCUPIED', current_employee_id = p_employee_id where id = p_workspace_id;

  perform public.log_admin_event(v_workspace.company_id, 'WORKSPACE', p_workspace_id, 'ASSIGNED', v_workspace.status, 'OCCUPIED',
    jsonb_build_object('employee_id', p_employee_id), p_notes);

  insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
  select v_workspace.company_id, e.user_id, 'WORKSPACE_ASSIGNED', 'Workspace assigned',
    'You have been assigned workspace ' || v_workspace.workspace_code, 'workspace', p_workspace_id
  from public.employees e where e.id = p_employee_id and e.user_id is not null
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  return v_assignment_id;
end;
$$;

grant execute on function public.assign_workspace(uuid, uuid, uuid, text) to authenticated;

create or replace function public.release_workspace(p_workspace_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace public.workspaces;
begin
  select * into v_workspace from public.workspaces where id = p_workspace_id for update;
  if v_workspace is null then raise exception 'Workspace not found'; end if;
  if not public.has_permission(v_workspace.company_id, 'ADMIN.WORKSPACES.MANAGE') then raise exception 'Access denied'; end if;

  update public.workspace_assignments
  set released_date = current_date, status = 'RELEASED'
  where workspace_id = p_workspace_id and status = 'ACTIVE';

  update public.workspaces set status = 'AVAILABLE', current_employee_id = null where id = p_workspace_id;

  perform public.log_admin_event(v_workspace.company_id, 'WORKSPACE', p_workspace_id, 'RELEASED', v_workspace.status, 'AVAILABLE', '{}', p_notes);
end;
$$;

grant execute on function public.release_workspace(uuid, text) to authenticated;
