-- =========================================================================
-- Fix: submit_leave_request(), cancel_leave_request(), and
-- submit_overtime_request() never checked that the caller actually owns
-- the request (or holds the relevant permission) before flipping its
-- status -- unlike submit_purchase_request() in Phase 3, which explicitly
-- verifies auth.uid() = requester_id OR has_permission(...) before acting.
-- Because these are SECURITY DEFINER, any authenticated user across ANY
-- company could otherwise submit or cancel a draft leave/overtime request
-- belonging to a different tenant simply by knowing its id. This adds the
-- same ownership/permission check the procurement RPCs already have.
-- =========================================================================
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
  v_employee public.employees%rowtype;
begin
  select * into v_lr from public.leave_requests where id = p_leave_request_id;
  if v_lr.id is null then raise exception 'Leave request not found'; end if;
  if v_lr.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;

  select * into v_employee from public.employees where id = v_lr.employee_id;
  if v_employee.user_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_lr.company_id, 'HR.LEAVE.CREATE')
     and not public.has_permission(v_lr.company_id, 'HR.LEAVE.UPDATE') then
    raise exception 'Missing permission';
  end if;

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

create or replace function public.cancel_leave_request(p_leave_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lr public.leave_requests%rowtype;
  v_employee public.employees%rowtype;
  v_balance_id uuid;
begin
  select * into v_lr from public.leave_requests where id = p_leave_request_id;
  if v_lr.id is null then raise exception 'Leave request not found'; end if;
  if v_lr.status not in ('DRAFT', 'SUBMITTED') then raise exception 'Only draft or submitted requests can be cancelled'; end if;

  select * into v_employee from public.employees where id = v_lr.employee_id;
  if v_employee.user_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_lr.company_id, 'HR.LEAVE.UPDATE') then
    raise exception 'Missing permission';
  end if;

  select id into v_balance_id from public.leave_balances
    where employee_id = v_lr.employee_id and leave_type_id = v_lr.leave_type_id and year = extract(year from v_lr.start_date)::integer;
  if v_balance_id is not null and v_lr.status = 'SUBMITTED' then
    update public.leave_balances set pending = greatest(pending - v_lr.days, 0) where id = v_balance_id;
  end if;

  update public.leave_requests set status = 'CANCELLED' where id = p_leave_request_id;
  perform public.log_employee_event(v_lr.company_id, v_lr.employee_id, 'LEAVE_CANCELLED', 'leave_request', null, v_lr.request_number);
end;
$$;

-- Same class of gap: get_or_create_leave_balance() took no company/ownership
-- check at all, so any authenticated user could seed a phantom balance row
-- for an employee in a company they have no relationship to (SECURITY
-- DEFINER bypasses the leave_balances RLS INSERT path). The row would be
-- unreadable to them afterward thanks to RLS SELECT, but it's still an
-- unauthorized cross-tenant write that shouldn't have been possible.
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
  v_employee public.employees%rowtype;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  v_company_id := v_employee.company_id;

  if v_employee.user_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_company_id, 'HR.LEAVE.VIEW')
     and not public.has_permission(v_company_id, 'HR.LEAVE.CREATE') then
    raise exception 'Missing permission';
  end if;

  select default_entitlement_days into v_entitlement from public.leave_types where id = p_leave_type_id;

  insert into public.leave_balances (company_id, employee_id, leave_type_id, year, entitlement)
  values (v_company_id, p_employee_id, p_leave_type_id, p_year, coalesce(v_entitlement, 0))
  on conflict (employee_id, leave_type_id, year) do update set updated_at = public.leave_balances.updated_at
  returning * into v_balance;

  return v_balance;
end;
$$;

create or replace function public.submit_overtime_request(p_overtime_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ot public.overtime_requests%rowtype;
  v_policy record;
  v_employee public.employees%rowtype;
begin
  select * into v_ot from public.overtime_requests where id = p_overtime_request_id;
  if v_ot.id is null then raise exception 'Overtime request not found'; end if;
  if v_ot.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;

  select * into v_employee from public.employees where id = v_ot.employee_id;
  if v_employee.user_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_ot.company_id, 'HR.OVERTIME.CREATE') then
    raise exception 'Missing permission';
  end if;

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
