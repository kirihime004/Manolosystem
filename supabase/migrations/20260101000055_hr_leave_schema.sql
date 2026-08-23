-- =========================================================================
-- PHASE 4: Leave management. Reuses Phase 3's `approval_policies` table
-- (company + module scoped, configurable sequence/permission/self-approval
-- rules) instead of inventing a second approval-chain mechanism -- just
-- widens its `module` CHECK constraint and adds a leave_request_approvals
-- table mirroring purchase_request_approvals.
-- =========================================================================
alter table public.approval_policies drop constraint approval_policies_module_check;
alter table public.approval_policies add constraint approval_policies_module_check
  check (module in ('PURCHASE_REQUEST', 'PURCHASE_ORDER', 'LEAVE_REQUEST', 'OVERTIME_REQUEST'));

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  is_paid boolean not null default true,
  default_entitlement_days numeric(5, 2) not null default 0,
  allow_negative_balance boolean not null default false,
  requires_approval boolean not null default true,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);
create trigger set_leave_types_updated_at before update on public.leave_types
  for each row execute function public.set_updated_at();
alter table public.leave_types enable row level security;

create or replace function public.seed_leave_types(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.leave_types (company_id, code, name, is_paid, default_entitlement_days) values
    (p_company_id, 'VACATION',    'Vacation Leave',    true,  15),
    (p_company_id, 'SICK',        'Sick Leave',         true,  15),
    (p_company_id, 'EMERGENCY',   'Emergency Leave',    true,  3),
    (p_company_id, 'MATERNITY',   'Maternity Leave',    true,  105),
    (p_company_id, 'PATERNITY',   'Paternity Leave',    true,  7),
    (p_company_id, 'BEREAVEMENT', 'Bereavement Leave',  true,  3),
    (p_company_id, 'UNPAID',      'Unpaid Leave',       false, 0),
    (p_company_id, 'SERVICE',     'Service Leave',      true,  5),
    (p_company_id, 'OTHER',       'Other',              false, 0)
  on conflict (company_id, code) do nothing;
end;
$$;

create or replace function public.seed_leave_types_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_leave_types(new.id);
  return new;
end;
$$;

create trigger seed_leave_types_on_company_insert
  after insert on public.companies
  for each row execute function public.seed_leave_types_trigger();

do $$
declare v_company record;
begin
  for v_company in select id from public.companies loop
    perform public.seed_leave_types(v_company.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Leave balances -- one row per employee/leave type/year. remaining is
-- generated, never written directly, so it can never drift from its
-- inputs.
-- ---------------------------------------------------------------------
create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  year integer not null,
  entitlement numeric(6, 2) not null default 0,
  used numeric(6, 2) not null default 0,
  pending numeric(6, 2) not null default 0,
  remaining numeric(6, 2) generated always as (entitlement - used - pending) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);
create trigger set_leave_balances_updated_at before update on public.leave_balances
  for each row execute function public.set_updated_at();
alter table public.leave_balances enable row level security;

create or replace function public.get_or_create_leave_balance(p_employee_id uuid, p_leave_type_id uuid, p_year integer)
returns public.leave_balances
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance public.leave_balances%rowtype;
  v_company_id uuid;
  v_entitlement numeric;
begin
  select company_id into v_company_id from public.employees where id = p_employee_id;
  select default_entitlement_days into v_entitlement from public.leave_types where id = p_leave_type_id;

  insert into public.leave_balances (company_id, employee_id, leave_type_id, year, entitlement)
  values (v_company_id, p_employee_id, p_leave_type_id, p_year, coalesce(v_entitlement, 0))
  on conflict (employee_id, leave_type_id, year) do update set updated_at = public.leave_balances.updated_at
  returning * into v_balance;

  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------
-- Leave requests + approval chain (mirrors purchase_request_approvals).
-- ---------------------------------------------------------------------
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_number text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  start_date date not null,
  end_date date not null,
  days numeric(5, 2) not null check (days > 0),
  reason text,
  attachment_path text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, request_number),
  check (end_date >= start_date)
);

create index leave_requests_employee_idx on public.leave_requests (employee_id, start_date desc);
create trigger set_leave_requests_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();
alter table public.leave_requests enable row level security;

create table public.leave_request_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  required_permission text not null,
  sequence integer not null default 1,
  decision text not null default 'PENDING' check (decision in ('PENDING', 'APPROVED', 'REJECTED')),
  decided_at timestamptz,
  comments text,
  created_at timestamptz not null default now()
);
create index leave_request_approvals_lr_idx on public.leave_request_approvals (leave_request_id, sequence);
alter table public.leave_request_approvals enable row level security;

create or replace function public.before_insert_leave_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Never trust a client-supplied company_id: derive it from the employee
  -- record so a self-service insert can't target another tenant.
  select company_id into new.company_id from public.employees where id = new.employee_id;
  if new.company_id is null then raise exception 'Invalid employee_id'; end if;
  new.request_number := public.generate_asset_code(new.company_id, 'LV');
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_leave_request_trigger
  before insert on public.leave_requests
  for each row execute function public.before_insert_leave_request();

create or replace function public.submit_leave_request(p_leave_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lr public.leave_requests%rowtype;
  v_policy record;
  v_balance public.leave_balances%rowtype;
  v_leave_type public.leave_types%rowtype;
begin
  select * into v_lr from public.leave_requests where id = p_leave_request_id;
  if v_lr.id is null then raise exception 'Leave request not found'; end if;
  if v_lr.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;

  select * into v_leave_type from public.leave_types where id = v_lr.leave_type_id;
  v_balance := public.get_or_create_leave_balance(v_lr.employee_id, v_lr.leave_type_id, extract(year from v_lr.start_date)::integer);

  if not v_leave_type.allow_negative_balance and (v_balance.remaining - v_lr.days) < 0 then
    raise exception 'Insufficient leave balance: % remaining, % requested', v_balance.remaining, v_lr.days;
  end if;

  update public.leave_balances set pending = pending + v_lr.days where id = v_balance.id;

  if v_leave_type.requires_approval then
    for v_policy in
      select * from public.get_applicable_approval_policies(v_lr.company_id, 'LEAVE_REQUEST', v_lr.days, null)
    loop
      insert into public.leave_request_approvals (company_id, leave_request_id, required_permission, sequence)
      values (v_lr.company_id, p_leave_request_id, v_policy.required_permission, v_policy.approval_sequence);
    end loop;
  end if;

  update public.leave_requests set status = 'SUBMITTED' where id = p_leave_request_id;

  perform public.log_employee_event(v_lr.company_id, v_lr.employee_id, 'LEAVE_SUBMITTED', 'leave_request', null, v_lr.request_number);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_lr.company_id, 'LEAVE_SUBMITTED', 'Leave request submitted',
    v_lr.request_number || ' is awaiting approval.', 'leave_request', p_leave_request_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.submit_leave_request(uuid) to authenticated;

create or replace function public.decide_leave_request_approval(p_approval_id uuid, p_decision text, p_comments text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.leave_request_approvals%rowtype;
  v_lr public.leave_requests%rowtype;
  v_employee public.employees%rowtype;
  v_policy public.approval_policies%rowtype;
  v_earlier_pending integer;
  v_remaining_pending integer;
  v_balance_id uuid;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_approval from public.leave_request_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_lr from public.leave_requests where id = v_approval.leave_request_id;
  if v_lr.status <> 'SUBMITTED' then raise exception 'Leave request is not awaiting approval'; end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  select * into v_employee from public.employees where id = v_lr.employee_id;
  if v_employee.user_id = auth.uid() then
    select * into v_policy from public.approval_policies
      where company_id = v_approval.company_id and module = 'LEAVE_REQUEST' and approval_sequence = v_approval.sequence and enabled
      limit 1;
    if v_policy.id is not null and not v_policy.allow_self_approval then
      raise exception 'You cannot approve your own leave request';
    end if;
  end if;

  select count(*) into v_earlier_pending from public.leave_request_approvals
    where leave_request_id = v_approval.leave_request_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then raise exception 'An earlier approval level is still pending'; end if;

  update public.leave_request_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  select id into v_balance_id from public.leave_balances
    where employee_id = v_lr.employee_id and leave_type_id = v_lr.leave_type_id and year = extract(year from v_lr.start_date)::integer;

  if p_decision = 'REJECTED' then
    update public.leave_requests set status = 'REJECTED' where id = v_lr.id;
    if v_balance_id is not null then
      update public.leave_balances set pending = greatest(pending - v_lr.days, 0) where id = v_balance_id;
    end if;
    perform public.log_employee_event(v_lr.company_id, v_lr.employee_id, 'LEAVE_REJECTED', 'leave_request', null, v_lr.request_number, null, p_comments);
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'LEAVE_REJECTED', 'Leave request rejected',
      v_lr.request_number || ' was rejected.', 'leave_request', v_lr.id, v_employee.user_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    return;
  end if;

  select count(*) into v_remaining_pending from public.leave_request_approvals
    where leave_request_id = v_lr.id and decision = 'PENDING';

  if v_remaining_pending = 0 then
    update public.leave_requests set status = 'APPROVED' where id = v_lr.id;
    if v_balance_id is not null then
      update public.leave_balances set pending = greatest(pending - v_lr.days, 0), used = used + v_lr.days where id = v_balance_id;
    end if;
    perform public.log_employee_event(v_lr.company_id, v_lr.employee_id, 'LEAVE_APPROVED', 'leave_request', null, v_lr.request_number);
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'LEAVE_APPROVED', 'Leave request approved',
      v_lr.request_number || ' has been approved.', 'leave_request', v_lr.id, v_employee.user_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;
end;
$$;

grant execute on function public.decide_leave_request_approval(uuid, text, text) to authenticated;

create or replace function public.cancel_leave_request(p_leave_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lr public.leave_requests%rowtype;
  v_balance_id uuid;
begin
  select * into v_lr from public.leave_requests where id = p_leave_request_id;
  if v_lr.id is null then raise exception 'Leave request not found'; end if;
  if v_lr.status not in ('DRAFT', 'SUBMITTED') then raise exception 'Only draft or submitted requests can be cancelled'; end if;

  select id into v_balance_id from public.leave_balances
    where employee_id = v_lr.employee_id and leave_type_id = v_lr.leave_type_id and year = extract(year from v_lr.start_date)::integer;
  if v_balance_id is not null and v_lr.status = 'SUBMITTED' then
    update public.leave_balances set pending = greatest(pending - v_lr.days, 0) where id = v_balance_id;
  end if;

  update public.leave_requests set status = 'CANCELLED' where id = p_leave_request_id;
  perform public.log_employee_event(v_lr.company_id, v_lr.employee_id, 'LEAVE_CANCELLED', 'leave_request', null, v_lr.request_number);
end;
$$;

grant execute on function public.cancel_leave_request(uuid) to authenticated;
