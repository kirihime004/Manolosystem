-- =========================================================================
-- Company-configurable onboarding/offboarding checklist templates.
-- start_onboarding()/start_offboarding() previously hard-coded a fixed
-- 7-item list inline (migration 059) -- there was no way for HR to add,
-- edit, remove, or reorder what a new hire's checklist actually contains.
-- This moves that list into per-company tables (seeded with the same 7
-- defaults each, so existing behavior is unchanged until someone edits
-- them) and rewrites both RPCs to read from it.
-- =========================================================================
create table public.onboarding_task_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department text not null check (department in ('HR', 'IT', 'ADMIN', 'MANAGER')),
  task_type text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_task_templates_company_idx on public.onboarding_task_templates (company_id, sort_order);
create trigger set_onboarding_task_templates_updated_at before update on public.onboarding_task_templates
  for each row execute function public.set_updated_at();
alter table public.onboarding_task_templates enable row level security;

create table public.offboarding_task_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department text not null check (department in ('HR', 'IT', 'ADMIN', 'FINANCE', 'MANAGER')),
  task_type text not null,
  title text not null,
  description text,
  sort_order integer not null default 0,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index offboarding_task_templates_company_idx on public.offboarding_task_templates (company_id, sort_order);
create trigger set_offboarding_task_templates_updated_at before update on public.offboarding_task_templates
  for each row execute function public.set_updated_at();
alter table public.offboarding_task_templates enable row level security;

create policy "onboarding_task_templates_select_members" on public.onboarding_task_templates
  for select using (public.has_company_access(company_id));
create policy "onboarding_task_templates_write_hr" on public.onboarding_task_templates
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'));

create policy "offboarding_task_templates_select_members" on public.offboarding_task_templates
  for select using (public.has_company_access(company_id));
create policy "offboarding_task_templates_write_hr" on public.offboarding_task_templates
  for all
  using (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'))
  with check (public.is_platform_superadmin() or public.has_permission(company_id, 'HR.SETTINGS.MANAGE'));

-- ---------------------------------------------------------------------
-- Seed defaults -- same 7+7 items start_onboarding()/start_offboarding()
-- already used, now living in editable tables instead of inline SQL.
-- ---------------------------------------------------------------------
create or replace function public.seed_hr_task_templates(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.onboarding_task_templates (company_id, department, task_type, title, sort_order) values
    (p_company_id, 'HR',      'EMPLOYMENT_CONTRACT', 'Prepare employment contract', 1),
    (p_company_id, 'HR',      'GOVERNMENT_RECORDS',  'Collect government records', 2),
    (p_company_id, 'IT',      'ACCOUNT',             'Create company account and email', 3),
    (p_company_id, 'IT',      'EQUIPMENT',           'Assign laptop and system access', 4),
    (p_company_id, 'ADMIN',   'WORKSPACE',           'Prepare workspace, desk, and access card', 5),
    (p_company_id, 'ADMIN',   'ORIENTATION',         'Office orientation', 6),
    (p_company_id, 'MANAGER', 'INTRODUCTION',        'Team introduction and role briefing', 7)
  on conflict do nothing;

  insert into public.offboarding_task_templates (company_id, department, task_type, title, sort_order) values
    (p_company_id, 'HR',      'EXIT_INTERVIEW',      'Conduct exit interview', 1),
    (p_company_id, 'HR',      'FINAL_DOCUMENTS',     'Prepare final documents', 2),
    (p_company_id, 'IT',      'RECOVER_EQUIPMENT',   'Recover laptop and IT equipment', 3),
    (p_company_id, 'IT',      'DISABLE_ACCOUNT',     'Disable company account and access', 4),
    (p_company_id, 'ADMIN',   'RECOVER_ACCESS',      'Recover keys, access card, workspace items', 5),
    (p_company_id, 'FINANCE', 'FINAL_SALARY',        'Process final salary and deductions', 6),
    (p_company_id, 'FINANCE', 'OUTSTANDING_EXPENSES','Settle outstanding expenses', 7)
  on conflict do nothing;
end;
$$;

create or replace function public.seed_hr_task_templates_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_hr_task_templates(new.id);
  return new;
end;
$$;

create trigger seed_hr_task_templates_on_company_insert
  after insert on public.companies
  for each row execute function public.seed_hr_task_templates_trigger();

do $$
declare v_company record;
begin
  for v_company in select id from public.companies loop
    perform public.seed_hr_task_templates(v_company.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- start_onboarding()/start_offboarding() now read the company's current
-- template list instead of a hard-coded VALUES list.
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

  insert into public.employee_onboarding_tasks (company_id, employee_id, department, task_type, title, description)
  select v_company_id, p_employee_id, t.department, t.task_type, t.title, t.description
  from public.onboarding_task_templates t
  where t.company_id = v_company_id and t.status = 'ACTIVE'
  order by t.sort_order;

  perform public.log_employee_event(v_company_id, p_employee_id, 'ONBOARDING_STARTED');
  select employee_number into v_number from public.employees where id = p_employee_id;
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_company_id, 'ONBOARDING_TASK', 'Onboarding started', v_number || ' onboarding checklist created.', 'employee', p_employee_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

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

  insert into public.employee_offboarding_tasks (company_id, employee_id, department, task_type, title, description)
  select v_company_id, p_employee_id, t.department, t.task_type, t.title, t.description
  from public.offboarding_task_templates t
  where t.company_id = v_company_id and t.status = 'ACTIVE'
  order by t.sort_order;

  perform public.log_employee_event(v_company_id, p_employee_id, 'OFFBOARDING_STARTED', null, null, null, p_reason);
  select employee_number into v_number from public.employees where id = p_employee_id;
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_company_id, 'OFFBOARDING_TASK', 'Offboarding started', v_number || ' offboarding checklist created.', 'employee', p_employee_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Per-employee ad-hoc task management: add/edit/delete on an already-
-- started checklist. Client INSERT/UPDATE/DELETE was already permitted
-- via the existing employee_onboarding_tasks/employee_offboarding_tasks
-- RLS write policies (HR.EMPLOYEES.UPDATE or assigned_to = auth.uid()),
-- but company_id was never derived server-side for a client INSERT --
-- closing that the same way the leave/overtime/hr_requests inserts were
-- closed in migration 064.
-- ---------------------------------------------------------------------
create or replace function public.before_insert_onboarding_task()
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

create trigger before_insert_onboarding_task_trigger
  before insert on public.employee_onboarding_tasks
  for each row execute function public.before_insert_onboarding_task();

create or replace function public.before_insert_offboarding_task()
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

create trigger before_insert_offboarding_task_trigger
  before insert on public.employee_offboarding_tasks
  for each row execute function public.before_insert_offboarding_task();
