-- =========================================================================
-- PHASE 7: Tasks -- the pipeline work unit, attached to exactly one shot
-- or one production asset -- plus task dependencies with real enforcement
-- (a Finish-to-Start dependency actually blocks the dependent task from
-- starting, per spec TEST 5, not just a display hint).
-- =========================================================================

create table public.production_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  task_type_id uuid references public.production_task_types(id) on delete set null,
  shot_id uuid references public.production_shots(id) on delete cascade,
  asset_id uuid references public.production_assets(id) on delete cascade,
  task_code text not null,
  name text not null,
  description text,
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED', 'READY', 'IN_PROGRESS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED', 'ON_HOLD')),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  risk_status text not null default 'ON_TRACK' check (risk_status in ('ON_TRACK', 'AT_RISK', 'LATE')),
  assigned_to uuid references public.employees(id) on delete set null,
  start_date date,
  due_date date,
  estimated_hours numeric(8,2),
  actual_hours numeric(8,2),
  bid_amount numeric(16,2),
  currency_id uuid references public.currencies(id),
  sort_order int not null default 0,
  custom_field_values jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_tasks_one_resource check (
    (shot_id is not null and asset_id is null) or (shot_id is null and asset_id is not null)
  )
);

create index idx_production_tasks_project on public.production_tasks(project_id);
create index idx_production_tasks_shot on public.production_tasks(shot_id);
create index idx_production_tasks_asset on public.production_tasks(asset_id);
create index idx_production_tasks_assigned on public.production_tasks(assigned_to);
create index idx_production_tasks_status on public.production_tasks(company_id, status);

alter table public.production_tasks enable row level security;

create policy "production_tasks_select" on public.production_tasks
  for select
  using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_TASKS')
    and (public.has_permission(company_id, 'PRODUCTION.TASKS.VIEW') or public.is_own_employee(assigned_to))
  );

create policy "production_tasks_insert" on public.production_tasks
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_TASKS') and public.has_permission(company_id, 'PRODUCTION.TASKS.CREATE'));

create policy "production_tasks_update" on public.production_tasks
  for update
  using (public.has_permission(company_id, 'PRODUCTION.TASKS.UPDATE') or public.is_own_employee(assigned_to))
  with check (public.has_permission(company_id, 'PRODUCTION.TASKS.UPDATE') or public.is_own_employee(assigned_to));

create policy "production_tasks_delete" on public.production_tasks
  for delete using (public.has_permission(company_id, 'PRODUCTION.TASKS.DELETE'));

create trigger trg_production_tasks_updated_at before update on public.production_tasks for each row execute function public.set_updated_at();

create or replace function public.before_insert_production_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.task_code is null or new.task_code = '' then
    new.task_code := public.generate_asset_code(new.company_id, 'TSK');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_task
  before insert on public.production_tasks
  for each row execute function public.before_insert_production_task();

-- ---------------------------------------------------------------------
-- Task dependencies. dependency_type follows the standard four project-
-- management relations; only Finish-to-Start is actively enforced below
-- (the common case, and the one the spec's own test case exercises) --
-- the others are recorded and shown, but don't block a status change.
-- ---------------------------------------------------------------------
create table public.production_task_dependencies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid not null references public.production_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.production_tasks(id) on delete cascade,
  dependency_type text not null default 'FS' check (dependency_type in ('FS', 'SS', 'FF', 'SF')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  constraint production_task_dependencies_no_self check (task_id <> depends_on_task_id)
);

create index idx_production_task_dependencies_task on public.production_task_dependencies(task_id);
create index idx_production_task_dependencies_depends_on on public.production_task_dependencies(depends_on_task_id);

alter table public.production_task_dependencies enable row level security;

create policy "production_task_dependencies_select" on public.production_task_dependencies
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_TASKS') and public.has_permission(company_id, 'PRODUCTION.TASKS.VIEW'));
create policy "production_task_dependencies_write" on public.production_task_dependencies
  for all
  using (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.DEPENDENCIES.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_TASKS')))
  with check (public.is_platform_superadmin() or (public.has_permission(company_id, 'PRODUCTION.DEPENDENCIES.MANAGE') and public.has_module_enabled(company_id, 'PRODUCTION_TASKS')));

-- Blocks a Finish-to-Start dependent task from moving into any
-- in-progress-or-later status while its predecessor isn't yet
-- COMPLETED or APPROVED. NOT_STARTED/ON_HOLD/READY-with-no-work remain
-- reachable so the row can still exist and be scheduled/assigned ahead
-- of time -- only real work states are blocked.
create or replace function public.enforce_task_dependency_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blocking_count int;
begin
  if new.status not in ('IN_PROGRESS', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  select count(*) into v_blocking_count
  from public.production_task_dependencies d
  join public.production_tasks predecessor on predecessor.id = d.depends_on_task_id
  where d.task_id = new.id
    and d.dependency_type = 'FS'
    and predecessor.status not in ('COMPLETED', 'APPROVED');

  if v_blocking_count > 0 then
    raise exception 'This task has % unfinished predecessor task(s) and cannot move to "%" yet', v_blocking_count, new.status;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_task_dependency_gate
  before update on public.production_tasks
  for each row execute function public.enforce_task_dependency_gate();

grant select, insert, update, delete on public.production_tasks, public.production_task_dependencies to authenticated;
