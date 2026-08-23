-- =========================================================================
-- PHASE 4: Overtime requests (same approval_policies-driven chain as
-- leave, module='OVERTIME_REQUEST') and timesheets. Timesheets get a
-- single-level HR.TIMESHEETS.APPROVE gate rather than the full policy
-- chain -- the spec doesn't ask for configurable multi-level approval
-- here, and project_id/task_id are deliberately unconstrained uuids
-- (no FK) since the Production module doesn't exist yet.
-- =========================================================================
create table public.overtime_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  total_hours numeric(5, 2) generated always as (round(extract(epoch from (end_time - start_time)) / 3600.0, 2)) stored,
  reason text,
  department_id uuid references public.departments(id) on delete set null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, request_number),
  check (end_time > start_time)
);

create index overtime_requests_employee_idx on public.overtime_requests (employee_id, work_date desc);
create trigger set_overtime_requests_updated_at before update on public.overtime_requests
  for each row execute function public.set_updated_at();
alter table public.overtime_requests enable row level security;

create table public.overtime_request_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  overtime_request_id uuid not null references public.overtime_requests(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  sequence integer not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);
create index overtime_request_approvals_or_idx on public.overtime_request_approvals (overtime_request_id, sequence);
alter table public.overtime_request_approvals enable row level security;

create or replace function public.before_insert_overtime_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.employees where id = new.employee_id;
  if new.company_id is null then raise exception 'Invalid employee_id'; end if;
  new.request_number := public.generate_asset_code(new.company_id, 'OT');
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_overtime_request_trigger
  before insert on public.overtime_requests
  for each row execute function public.before_insert_overtime_request();

create or replace function public.submit_overtime_request(p_overtime_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ot public.overtime_requests%rowtype;
  v_policy record;
begin
  select * into v_ot from public.overtime_requests where id = p_overtime_request_id;
  if v_ot.id is null then raise exception 'Overtime request not found'; end if;
  if v_ot.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;

  for v_policy in
    select * from public.get_applicable_approval_policies(v_ot.company_id, 'OVERTIME_REQUEST', v_ot.total_hours, null)
  loop
    insert into public.overtime_request_approvals (company_id, overtime_request_id, required_permission, sequence)
    values (v_ot.company_id, p_overtime_request_id, v_policy.required_permission, v_policy.approval_sequence);
  end loop;

  update public.overtime_requests set status = 'SUBMITTED' where id = p_overtime_request_id;
  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_ot.company_id, 'OVERTIME_SUBMITTED', 'Overtime request submitted',
    v_ot.request_number || ' is awaiting approval.', 'overtime_request', p_overtime_request_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.submit_overtime_request(uuid) to authenticated;

create or replace function public.decide_overtime_request_approval(p_approval_id uuid, p_decision text, p_comments text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.overtime_request_approvals%rowtype;
  v_ot public.overtime_requests%rowtype;
  v_employee public.employees%rowtype;
  v_policy public.approval_policies%rowtype;
  v_earlier_pending integer;
  v_remaining_pending integer;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_approval from public.overtime_request_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_ot from public.overtime_requests where id = v_approval.overtime_request_id;
  if v_ot.status <> 'SUBMITTED' then raise exception 'Overtime request is not awaiting approval'; end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  select * into v_employee from public.employees where id = v_ot.employee_id;
  if v_employee.user_id = auth.uid() then
    select * into v_policy from public.approval_policies
      where company_id = v_approval.company_id and module = 'OVERTIME_REQUEST' and approval_sequence = v_approval.sequence and enabled
      limit 1;
    if v_policy.id is not null and not v_policy.allow_self_approval then
      raise exception 'You cannot approve your own overtime request';
    end if;
  end if;

  select count(*) into v_earlier_pending from public.overtime_request_approvals
    where overtime_request_id = v_approval.overtime_request_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then raise exception 'An earlier approval level is still pending'; end if;

  update public.overtime_request_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  if p_decision = 'REJECTED' then
    update public.overtime_requests set status = 'REJECTED' where id = v_ot.id;
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'OVERTIME_REJECTED', 'Overtime request rejected',
      v_ot.request_number || ' was rejected.', 'overtime_request', v_ot.id, v_employee.user_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    return;
  end if;

  select count(*) into v_remaining_pending from public.overtime_request_approvals
    where overtime_request_id = v_ot.id and decision = 'PENDING';

  if v_remaining_pending = 0 then
    update public.overtime_requests set status = 'APPROVED' where id = v_ot.id;
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'OVERTIME_APPROVED', 'Overtime request approved',
      v_ot.request_number || ' has been approved.', 'overtime_request', v_ot.id, v_employee.user_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;
end;
$$;

grant execute on function public.decide_overtime_request_approval(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Timesheets
-- ---------------------------------------------------------------------
create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  project_id uuid,
  task_id uuid,
  project_name text,
  task_name text,
  start_time timestamptz,
  end_time timestamptz,
  hours numeric(5, 2) not null check (hours > 0),
  notes text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index timesheets_employee_idx on public.timesheets (employee_id, work_date desc);
create trigger set_timesheets_updated_at before update on public.timesheets
  for each row execute function public.set_updated_at();
alter table public.timesheets enable row level security;

create or replace function public.before_insert_timesheet()
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

create trigger before_insert_timesheet_trigger
  before insert on public.timesheets
  for each row execute function public.before_insert_timesheet();

create or replace function public.decide_timesheet(p_timesheet_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ts public.timesheets%rowtype;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;
  select * into v_ts from public.timesheets where id = p_timesheet_id;
  if v_ts.id is null then raise exception 'Timesheet not found'; end if;
  if v_ts.status <> 'SUBMITTED' then raise exception 'Only submitted timesheets can be decided'; end if;
  if not public.has_permission(v_ts.company_id, 'HR.TIMESHEETS.APPROVE') then
    raise exception 'Missing permission HR.TIMESHEETS.APPROVE';
  end if;

  update public.timesheets set status = p_decision, approved_by = auth.uid(), approved_at = now() where id = p_timesheet_id;
end;
$$;

grant execute on function public.decide_timesheet(uuid, text) to authenticated;
