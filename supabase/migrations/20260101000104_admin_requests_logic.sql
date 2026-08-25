-- =========================================================================
-- PHASE 6: Administration -- Admin Requests business logic: numbering,
-- currency-quadruple population, the full status-transition workflow
-- (Draft -> Submitted -> Under Review -> [Pending Approval ->] Approved ->
-- Assigned -> In Progress -> [Waiting ->] Completed -> Closed, or
-- Rejected/Cancelled at various points), history logging via
-- log_admin_event(), and notifications. Widens approval_policies.module
-- and notifications.type -- the two shared, hand-maintained catalogs every
-- phase widens rather than duplicating.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Numbering + currency quadruple, same shape as before_insert triggers
-- throughout Procurement/Finance: derive request_number via
-- generate_asset_code(), snapshot the base-currency conversion once at
-- insert time (never recalculated), leave both null if no cost was given.
-- ---------------------------------------------------------------------
create or replace function public.before_insert_admin_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_currency_id uuid;
begin
  new.request_number := public.generate_asset_code(new.company_id, 'ADM-REQ');

  if new.estimated_cost is not null and new.currency_id is not null then
    select base_currency_id into v_base_currency_id
    from public.company_currency_settings where company_id = new.company_id;

    new.base_currency_id := v_base_currency_id;
    new.exchange_rate := case
      when new.currency_id = v_base_currency_id then 1
      else public.get_exchange_rate(new.currency_id, v_base_currency_id, current_date)
    end;
    new.base_currency_amount := case
      when new.exchange_rate is null then null
      else round(new.estimated_cost * new.exchange_rate, 2)
    end;
  end if;

  return new;
end;
$$;

create trigger before_insert_admin_request_trigger
  before insert on public.admin_requests
  for each row execute function public.before_insert_admin_request();

-- ---------------------------------------------------------------------
-- Widen the shared approval_policies.module catalog. No default policy
-- row is auto-seeded for ADMIN_REQUEST (mirrors the JOURNAL_ENTRY
-- precedent) -- approval_required stays false/manual until a company
-- explicitly configures a policy.
-- ---------------------------------------------------------------------
alter table public.approval_policies drop constraint approval_policies_module_check;
alter table public.approval_policies add constraint approval_policies_module_check
  check (module in (
    'PURCHASE_REQUEST', 'PURCHASE_ORDER', 'LEAVE_REQUEST', 'OVERTIME_REQUEST',
    'JOURNAL_ENTRY', 'BILL', 'EXPENSE', 'PAYROLL', 'ADMIN_REQUEST', 'TRAVEL_REQUEST'
  ));

-- ---------------------------------------------------------------------
-- Widen the shared notifications.type catalog with every Admin type the
-- Phase 6 spec's notification section (84) calls for, in one pass, so
-- later Admin migrations (supplies, maintenance, vehicles, contracts,
-- compliance, travel, visitors, meetings, events, workspaces) don't need
-- to touch this constraint again.
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'HARDWARE_NEARING_EOL', 'HARDWARE_OVER_EOL', 'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED',
  'SUBSCRIPTION_RENEWAL_DUE', 'SUBSCRIPTION_EXPIRED', 'IP_CONFLICT', 'ASSET_DEFECTIVE', 'REPAIR_OVERDUE',
  'PR_SUBMITTED', 'PR_APPROVED', 'PR_REJECTED',
  'PO_AWAITING_APPROVAL', 'PO_APPROVED', 'PO_SENT_TO_SUPPLIER',
  'DELIVERY_OVERDUE', 'DELIVERY_PARTIAL',
  'BUDGET_THRESHOLD', 'BUDGET_PERIOD_ENDING',
  'NEW_EMPLOYEE', 'ONBOARDING_TASK', 'OFFBOARDING_TASK', 'PROBATION_ENDING',
  'CONTRACT_EXPIRING', 'DOCUMENT_EXPIRING',
  'LEAVE_SUBMITTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
  'ATTENDANCE_CORRECTION_SUBMITTED', 'ATTENDANCE_CORRECTION_APPROVED', 'ATTENDANCE_CORRECTION_REJECTED',
  'OVERTIME_SUBMITTED', 'OVERTIME_APPROVED', 'OVERTIME_REJECTED',
  'PAYROLL_PENDING', 'EMPLOYEE_TERMINATED',
  'HR_REQUEST_SUBMITTED', 'HR_REQUEST_UNDER_REVIEW', 'HR_REQUEST_APPROVED',
  'HR_REQUEST_REJECTED', 'HR_REQUEST_COMPLETED', 'HR_REQUEST_CANCELLED',
  'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'EXPENSE_REJECTED', 'PAYMENT_COMPLETED',
  'PAYROLL_APPROVED', 'PAYROLL_PAID',
  'INVOICE_DUE', 'INVOICE_OVERDUE', 'BILL_DUE', 'BILL_OVERDUE',
  'TAX_DEADLINE', 'FINANCIAL_PERIOD_CLOSING', 'BANK_RECONCILIATION_REQUIRED',
  'ADMIN_REQUEST_SUBMITTED', 'ADMIN_REQUEST_ASSIGNED', 'ADMIN_REQUEST_APPROVED',
  'ADMIN_REQUEST_REJECTED', 'ADMIN_REQUEST_COMPLETED',
  'LOW_OFFICE_STOCK', 'MAINTENANCE_DUE', 'MAINTENANCE_OVERDUE',
  'VEHICLE_REGISTRATION_EXPIRING', 'VEHICLE_INSURANCE_EXPIRING',
  'ADMIN_CONTRACT_EXPIRING', 'ADMIN_DOCUMENT_EXPIRING', 'ADMIN_COMPLIANCE_EXPIRING',
  'TRAVEL_APPROVAL_NEEDED', 'VISITOR_EXPECTED', 'MEETING_REMINDER', 'EVENT_REMINDER',
  'WORKSPACE_ASSIGNED', 'OFFICE_RELOCATION'
));

-- ---------------------------------------------------------------------
-- submit_admin_request: DRAFT -> SUBMITTED. Callable by the requester or
-- anyone holding ADMIN.REQUESTS.CREATE.
-- ---------------------------------------------------------------------
create or replace function public.submit_admin_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not public.has_company_access(v_request.company_id) then raise exception 'Access denied'; end if;
  if not (public.is_own_employee(v_request.requester_id) or public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.CREATE')) then
    raise exception 'Not authorized to submit this request';
  end if;
  if v_request.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;

  update public.admin_requests set status = 'SUBMITTED', submitted_at = now() where id = p_request_id;

  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'SUBMITTED', 'DRAFT', 'SUBMITTED');

  insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
  select v_request.company_id, cu.user_id, 'ADMIN_REQUEST_SUBMITTED',
    'New administrative request', v_request.request_number || ': ' || v_request.subject,
    'admin_request', p_request_id
  from public.company_users cu
  join public.user_roles ur on ur.company_user_id = cu.id
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id and p.key = 'ADMIN.REQUESTS.UPDATE'
  where cu.company_id = v_request.company_id and cu.status = 'ACTIVE'
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.submit_admin_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- start_admin_request_review: SUBMITTED -> UNDER_REVIEW.
-- ---------------------------------------------------------------------
create or replace function public.start_admin_request_review(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.UPDATE') then raise exception 'Access denied'; end if;
  if v_request.status <> 'SUBMITTED' then raise exception 'Only submitted requests can start review'; end if;

  update public.admin_requests set status = 'UNDER_REVIEW' where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'UNDER_REVIEW', 'SUBMITTED', 'UNDER_REVIEW');
end;
$$;

grant execute on function public.start_admin_request_review(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- route_admin_request_for_approval: UNDER_REVIEW -> PENDING_APPROVAL,
-- materializing one admin_request_approvals row per matching
-- approval_policies sequence step (module = 'ADMIN_REQUEST'), same
-- pattern as purchase_requests/leave_requests. If no policy matches,
-- raises -- callers should assign directly instead when no approval is
-- configured/needed.
-- ---------------------------------------------------------------------
create or replace function public.route_admin_request_for_approval(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
  v_count integer;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.UPDATE') then raise exception 'Access denied'; end if;
  if v_request.status <> 'UNDER_REVIEW' then raise exception 'Only requests under review can be routed for approval'; end if;

  insert into public.admin_request_approvals (company_id, request_id, required_permission, sequence)
  select v_request.company_id, p_request_id, ap.required_permission, ap.approval_sequence
  from public.approval_policies ap
  where ap.company_id = v_request.company_id
    and ap.module = 'ADMIN_REQUEST'
    and ap.enabled
    and coalesce(v_request.base_currency_amount, 0) >= ap.minimum_amount
    and (ap.maximum_amount is null or coalesce(v_request.base_currency_amount, 0) <= ap.maximum_amount)
  order by ap.approval_sequence;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No approval policy matches this request -- assign it directly instead';
  end if;

  update public.admin_requests set status = 'PENDING_APPROVAL', approval_required = true where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'ROUTED_FOR_APPROVAL', 'UNDER_REVIEW', 'PENDING_APPROVAL');
end;
$$;

grant execute on function public.route_admin_request_for_approval(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- decide_admin_request_approval: records one approver's decision. A
-- rejection at any sequence step rejects the whole request; once every
-- sequence step is APPROVED, the request moves to APPROVED.
-- ---------------------------------------------------------------------
create or replace function public.decide_admin_request_approval(
  p_approval_id uuid, p_decision text, p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.admin_request_approvals;
  v_request public.admin_requests;
  v_remaining integer;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_approval from public.admin_request_approvals where id = p_approval_id for update;
  if v_approval is null then raise exception 'Approval step not found'; end if;
  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Access denied';
  end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval step was already decided'; end if;

  select * into v_request from public.admin_requests where id = v_approval.request_id for update;
  if v_request.status <> 'PENDING_APPROVAL' then raise exception 'Request is not pending approval'; end if;

  update public.admin_request_approvals
  set decision = p_decision, approver_id = auth.uid(), decided_at = now(), comments = p_comments
  where id = p_approval_id;

  if p_decision = 'REJECTED' then
    update public.admin_requests set status = 'REJECTED' where id = v_request.id;
    perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', v_request.id, 'REJECTED', 'PENDING_APPROVAL', 'REJECTED', notes => p_comments);
    insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
    select v_request.company_id, e.user_id, 'ADMIN_REQUEST_REJECTED', 'Request rejected',
      v_request.request_number || ' was rejected', 'admin_request', v_request.id
    from public.employees e where e.id = v_request.requester_id and e.user_id is not null
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    return;
  end if;

  select count(*) into v_remaining from public.admin_request_approvals
  where request_id = v_request.id and decision = 'PENDING';

  if v_remaining = 0 then
    update public.admin_requests set status = 'APPROVED' where id = v_request.id;
    perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', v_request.id, 'APPROVED', 'PENDING_APPROVAL', 'APPROVED');
    insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
    select v_request.company_id, e.user_id, 'ADMIN_REQUEST_APPROVED', 'Request approved',
      v_request.request_number || ' was approved', 'admin_request', v_request.id
    from public.employees e where e.id = v_request.requester_id and e.user_id is not null
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;
end;
$$;

grant execute on function public.decide_admin_request_approval(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- assign_admin_request: UNDER_REVIEW or APPROVED -> ASSIGNED.
-- ---------------------------------------------------------------------
create or replace function public.assign_admin_request(p_request_id uuid, p_assigned_to uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.ASSIGN') then raise exception 'Access denied'; end if;
  if v_request.status not in ('UNDER_REVIEW', 'APPROVED') then
    raise exception 'Only requests under review or approved can be assigned';
  end if;

  update public.admin_requests set status = 'ASSIGNED', assigned_to = p_assigned_to where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'ASSIGNED', v_request.status, 'ASSIGNED');

  insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
  values (v_request.company_id, p_assigned_to, 'ADMIN_REQUEST_ASSIGNED', 'Request assigned to you',
    v_request.request_number || ': ' || v_request.subject, 'admin_request', p_request_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.assign_admin_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- start_admin_request_work / mark_admin_request_waiting / complete /
-- close / cancel / reject_admin_request -- the remaining lifecycle steps.
-- ---------------------------------------------------------------------
create or replace function public.start_admin_request_work(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not (v_request.assigned_to = auth.uid() or public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.UPDATE')) then
    raise exception 'Access denied';
  end if;
  if v_request.status <> 'ASSIGNED' then raise exception 'Only assigned requests can start work'; end if;

  update public.admin_requests set status = 'IN_PROGRESS' where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'STARTED', 'ASSIGNED', 'IN_PROGRESS');
end;
$$;

grant execute on function public.start_admin_request_work(uuid) to authenticated;

create or replace function public.mark_admin_request_waiting(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not (v_request.assigned_to = auth.uid() or public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.UPDATE')) then
    raise exception 'Access denied';
  end if;
  if v_request.status <> 'IN_PROGRESS' then raise exception 'Only in-progress requests can be marked waiting'; end if;

  update public.admin_requests set status = 'WAITING' where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'WAITING', 'IN_PROGRESS', 'WAITING', notes => p_reason);
end;
$$;

grant execute on function public.mark_admin_request_waiting(uuid, text) to authenticated;

create or replace function public.complete_admin_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not (v_request.assigned_to = auth.uid() or public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.UPDATE')) then
    raise exception 'Access denied';
  end if;
  if v_request.status not in ('IN_PROGRESS', 'WAITING') then raise exception 'Request is not in progress'; end if;

  update public.admin_requests set status = 'COMPLETED', completed_at = now() where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'COMPLETED', v_request.status, 'COMPLETED');

  insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
  select v_request.company_id, e.user_id, 'ADMIN_REQUEST_COMPLETED', 'Request completed',
    v_request.request_number || ' has been completed', 'admin_request', p_request_id
  from public.employees e where e.id = v_request.requester_id and e.user_id is not null
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.complete_admin_request(uuid) to authenticated;

create or replace function public.close_admin_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.CLOSE') then raise exception 'Access denied'; end if;
  if v_request.status <> 'COMPLETED' then raise exception 'Only completed requests can be closed'; end if;

  update public.admin_requests set status = 'CLOSED' where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'CLOSED', 'COMPLETED', 'CLOSED');
end;
$$;

grant execute on function public.close_admin_request(uuid) to authenticated;

create or replace function public.reject_admin_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.APPROVE') then raise exception 'Access denied'; end if;
  if v_request.status not in ('UNDER_REVIEW', 'PENDING_APPROVAL') then
    raise exception 'Only requests under review or pending approval can be rejected';
  end if;

  update public.admin_requests set status = 'REJECTED' where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'REJECTED', v_request.status, 'REJECTED', notes => p_reason);

  insert into public.notifications (company_id, user_id, type, title, message, resource_type, resource_id)
  select v_request.company_id, e.user_id, 'ADMIN_REQUEST_REJECTED', 'Request rejected',
    v_request.request_number || ' was rejected', 'admin_request', p_request_id
  from public.employees e where e.id = v_request.requester_id and e.user_id is not null
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

grant execute on function public.reject_admin_request(uuid, text) to authenticated;

create or replace function public.cancel_admin_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.admin_requests;
begin
  select * into v_request from public.admin_requests where id = p_request_id for update;
  if v_request is null then raise exception 'Admin request not found'; end if;
  if not (
    (public.is_own_employee(v_request.requester_id) and v_request.status in ('DRAFT', 'SUBMITTED'))
    or public.has_permission(v_request.company_id, 'ADMIN.REQUESTS.UPDATE')
  ) then
    raise exception 'Access denied';
  end if;
  if v_request.status in ('COMPLETED', 'CLOSED', 'CANCELLED', 'REJECTED') then
    raise exception 'This request can no longer be cancelled';
  end if;

  update public.admin_requests set status = 'CANCELLED' where id = p_request_id;
  perform public.log_admin_event(v_request.company_id, 'ADMIN_REQUEST', p_request_id, 'CANCELLED', v_request.status, 'CANCELLED');
end;
$$;

grant execute on function public.cancel_admin_request(uuid) to authenticated;
