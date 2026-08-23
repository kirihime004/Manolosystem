-- =========================================================================
-- PHASE 4: Onboarding/offboarding task checklists. HR coordinates by
-- seeding the checklist; each department (HR/IT/ADMIN/MANAGER/FINANCE)
-- owns and completes only its own tasks -- this table never grants HR
-- write access to IT/Finance/Admin's own systems, only a task record
-- that those departments' staff mark done.
-- =========================================================================
create table public.employee_onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  department text not null check (department in ('HR', 'IT', 'ADMIN', 'MANAGER')),
  task_type text not null,
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED')),
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_onboarding_tasks_employee_idx on public.employee_onboarding_tasks (employee_id);
create trigger set_employee_onboarding_tasks_updated_at before update on public.employee_onboarding_tasks
  for each row execute function public.set_updated_at();
alter table public.employee_onboarding_tasks enable row level security;

create table public.employee_offboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  department text not null check (department in ('HR', 'IT', 'ADMIN', 'FINANCE', 'MANAGER')),
  task_type text not null,
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'CANCELLED')),
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_offboarding_tasks_employee_idx on public.employee_offboarding_tasks (employee_id);
create trigger set_employee_offboarding_tasks_updated_at before update on public.employee_offboarding_tasks
  for each row execute function public.set_updated_at();
alter table public.employee_offboarding_tasks enable row level security;

create or replace function public.complete_task_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'COMPLETED' and old.status <> 'COMPLETED' then
    new.completed_at := now();
  end if;
  return new;
end;
$$;

create trigger employee_onboarding_tasks_complete_ts before update on public.employee_onboarding_tasks
  for each row execute function public.complete_task_timestamp();
create trigger employee_offboarding_tasks_complete_ts before update on public.employee_offboarding_tasks
  for each row execute function public.complete_task_timestamp();

-- ---------------------------------------------------------------------
-- start_onboarding() / start_offboarding(): HR-triggered, not automatic
-- on every insert -- a bulk-imported already-active employee shouldn't
-- spawn a fresh onboarding checklist. Seeds one representative task per
-- owning department, matching the spec's own examples.
-- ---------------------------------------------------------------------
create or replace function public.start_onboarding(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_number text;
begin
  select company_id into v_company_id from public.employees where id = p_employee_id;
  if v_company_id is null then raise exception 'Employee not found'; end if;
  if not public.has_permission(v_company_id, 'HR.EMPLOYEES.UPDATE') then
    raise exception 'Missing permission HR.EMPLOYEES.UPDATE';
  end if;

  insert into public.employee_onboarding_tasks (company_id, employee_id, department, task_type, title) values
    (v_company_id, p_employee_id, 'HR',      'EMPLOYMENT_CONTRACT', 'Prepare employment contract'),
    (v_company_id, p_employee_id, 'HR',      'GOVERNMENT_RECORDS',  'Collect government records'),
    (v_company_id, p_employee_id, 'IT',      'ACCOUNT',             'Create company account and email'),
    (v_company_id, p_employee_id, 'IT',      'EQUIPMENT',           'Assign laptop and system access'),
    (v_company_id, p_employee_id, 'ADMIN',   'WORKSPACE',           'Prepare workspace, desk, and access card'),
    (v_company_id, p_employee_id, 'ADMIN',   'ORIENTATION',         'Office orientation'),
    (v_company_id, p_employee_id, 'MANAGER', 'INTRODUCTION',        'Team introduction and role briefing');

  perform public.log_employee_event(v_company_id, p_employee_id, 'ONBOARDING_STARTED');
  select employee_number into v_number from public.employees where id = p_employee_id;
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_company_id, 'ONBOARDING_TASK', 'Onboarding started', v_number || ' onboarding checklist created.', 'employee', p_employee_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.start_onboarding(uuid) to authenticated;

create or replace function public.start_offboarding(p_employee_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_number text;
begin
  select company_id into v_company_id from public.employees where id = p_employee_id;
  if v_company_id is null then raise exception 'Employee not found'; end if;
  if not public.has_permission(v_company_id, 'HR.EMPLOYEES.UPDATE') then
    raise exception 'Missing permission HR.EMPLOYEES.UPDATE';
  end if;

  insert into public.employee_offboarding_tasks (company_id, employee_id, department, task_type, title) values
    (v_company_id, p_employee_id, 'HR',      'EXIT_INTERVIEW', 'Conduct exit interview'),
    (v_company_id, p_employee_id, 'HR',      'FINAL_DOCUMENTS', 'Prepare final documents'),
    (v_company_id, p_employee_id, 'IT',      'RECOVER_EQUIPMENT', 'Recover laptop and IT equipment'),
    (v_company_id, p_employee_id, 'IT',      'DISABLE_ACCOUNT', 'Disable company account and access'),
    (v_company_id, p_employee_id, 'ADMIN',   'RECOVER_ACCESS', 'Recover keys, access card, workspace items'),
    (v_company_id, p_employee_id, 'FINANCE', 'FINAL_SALARY', 'Process final salary and deductions'),
    (v_company_id, p_employee_id, 'FINANCE', 'OUTSTANDING_EXPENSES', 'Settle outstanding expenses');

  perform public.log_employee_event(v_company_id, p_employee_id, 'OFFBOARDING_STARTED', null, null, null, p_reason);
  select employee_number into v_number from public.employees where id = p_employee_id;
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_company_id, 'OFFBOARDING_TASK', 'Offboarding started', v_number || ' offboarding checklist created.', 'employee', p_employee_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.start_offboarding(uuid, text) to authenticated;
