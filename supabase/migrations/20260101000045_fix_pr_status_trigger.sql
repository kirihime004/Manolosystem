-- before_update_purchase_request() was meant to block a client from
-- hand-setting status='APPROVED' directly (skipping budget commitment /
-- approval-completeness logic), but its condition was wrong: it also
-- blocked submit_purchase_request()/decide_purchase_request_approval()'s
-- OWN status updates, since those aren't SECURITY DEFINER-privileged from
-- the trigger's point of view -- the trigger only sees status values, not
-- who/what issued the UPDATE. Fixed with a session-local flag the RPCs
-- set immediately before their own status-changing UPDATE, the same
-- pattern already used for asset reassignment reasons.
create or replace function public.before_update_purchase_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;
  if new.request_number <> old.request_number then raise exception 'request_number cannot be changed'; end if;
  if new.requester_id <> old.requester_id then raise exception 'requester_id cannot be changed'; end if;

  if new.status is distinct from old.status then
    if current_setting('app.pr_status_transition', true) = new.status then
      -- explicitly authorized by submit_purchase_request()/
      -- decide_purchase_request_approval() immediately before this UPDATE
      null;
    elsif old.status = 'DRAFT' and new.status in ('SUBMITTED', 'CANCELLED') then
      null;
    else
      raise exception 'Use submit_purchase_request()/decide_purchase_request_approval() to change status';
    end if;
  end if;

  if (new.reason, new.description, new.required_date, new.priority, new.budget_id, new.budget_category_id, new.ticket_id)
     is distinct from
     (old.reason, old.description, old.required_date, old.priority, old.budget_id, old.budget_category_id, old.ticket_id)
     and old.status <> 'DRAFT'
     and not public.has_permission(old.company_id, 'IT.PROCUREMENT.UPDATE') then
    raise exception 'Only draft requests can be freely edited';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.submit_purchase_request(p_purchase_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pr public.purchase_requests%rowtype;
  v_policy record;
  v_base_currency_id uuid;
  v_rate numeric;
  v_check record;
begin
  select * into v_pr from public.purchase_requests where id = p_purchase_request_id;
  if v_pr.id is null then raise exception 'Purchase request not found'; end if;
  if v_pr.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;
  if v_pr.requester_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_pr.company_id, 'IT.PROCUREMENT.UPDATE') then
    raise exception 'Missing permission';
  end if;

  select base_currency_id into v_base_currency_id
  from public.company_currency_settings where company_id = v_pr.company_id;

  if v_pr.currency_id = v_base_currency_id then
    v_rate := 1;
  else
    v_rate := public.get_exchange_rate(v_pr.currency_id, v_base_currency_id);
    if v_rate is null then
      raise exception 'No exchange rate is available to convert this request into the company base currency';
    end if;
  end if;

  if v_pr.budget_id is not null then
    select * into v_check from public.check_budget_availability(v_pr.budget_id, v_pr.budget_category_id, v_pr.estimated_total, v_pr.currency_id);
    if not v_check.is_available then
      raise exception 'Insufficient budget: % available, % requested (in budget currency)', v_check.available_amount, v_check.converted_amount;
    end if;
  end if;

  perform set_config('app.pr_status_transition', 'SUBMITTED', true);
  update public.purchase_requests set
    status = 'SUBMITTED',
    base_currency_id = v_base_currency_id,
    exchange_rate = v_rate,
    base_currency_amount = round(estimated_total * v_rate, 2)
  where id = p_purchase_request_id;

  for v_policy in
    select * from public.get_applicable_approval_policies(
      v_pr.company_id, 'PURCHASE_REQUEST', round(v_pr.estimated_total * v_rate, 2), v_base_currency_id
    )
  loop
    insert into public.purchase_request_approvals (company_id, purchase_request_id, required_permission, approval_level, sequence)
    values (v_pr.company_id, p_purchase_request_id, v_policy.required_permission, v_policy.approval_sequence, v_policy.approval_sequence);
  end loop;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_pr.company_id, 'PR_SUBMITTED', 'Purchase request submitted',
    v_pr.request_number || ' was submitted and is awaiting approval.', 'purchase_request', p_purchase_request_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;

create or replace function public.decide_purchase_request_approval(
  p_approval_id uuid, p_decision text, p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.purchase_request_approvals%rowtype;
  v_pr public.purchase_requests%rowtype;
  v_policy public.approval_policies%rowtype;
  v_earlier_pending integer;
  v_remaining_pending integer;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid decision';
  end if;

  select * into v_approval from public.purchase_request_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_pr from public.purchase_requests where id = v_approval.purchase_request_id;
  if v_pr.status not in ('SUBMITTED', 'UNDER_REVIEW') then
    raise exception 'Purchase request is not awaiting approval';
  end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  if v_pr.requester_id = auth.uid() then
    select * into v_policy from public.approval_policies
      where company_id = v_approval.company_id and module = 'PURCHASE_REQUEST'
        and approval_sequence = v_approval.sequence and enabled
      limit 1;
    if v_policy.id is not null and not v_policy.allow_self_approval then
      raise exception 'You cannot approve your own request';
    end if;
  end if;

  select count(*) into v_earlier_pending from public.purchase_request_approvals
    where purchase_request_id = v_approval.purchase_request_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then
    raise exception 'An earlier approval level is still pending';
  end if;

  update public.purchase_request_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  perform public.log_procurement_event(v_approval.company_id, 'purchase_request', v_pr.id,
    case when p_decision = 'APPROVED' then 'APPROVAL_GRANTED' else 'APPROVAL_REJECTED' end,
    v_pr.status, v_pr.status, jsonb_build_object('sequence', v_approval.sequence), p_comments);

  if p_decision = 'REJECTED' then
    perform set_config('app.pr_status_transition', 'REJECTED', true);
    update public.purchase_requests set status = 'REJECTED' where id = v_pr.id;
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'PR_REJECTED', 'Purchase request rejected',
      v_pr.request_number || ' was rejected.', 'purchase_request', v_pr.id, v_pr.requester_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    return;
  end if;

  select count(*) into v_remaining_pending from public.purchase_request_approvals
    where purchase_request_id = v_pr.id and decision = 'PENDING';

  if v_remaining_pending = 0 then
    perform set_config('app.pr_status_transition', 'APPROVED', true);
    update public.purchase_requests set status = 'APPROVED' where id = v_pr.id;

    if v_pr.budget_id is not null then
      insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
      values (v_pr.company_id, v_pr.budget_id, v_pr.budget_category_id, coalesce(v_pr.base_currency_amount, v_pr.estimated_total),
        coalesce(v_pr.base_currency_id, v_pr.currency_id), 'COMMITMENT', 'purchase_request', v_pr.id,
        'Committed for ' || v_pr.request_number, auth.uid());
    end if;

    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    values (v_approval.company_id, 'PR_APPROVED', 'Purchase request approved',
      v_pr.request_number || ' has been fully approved.', 'purchase_request', v_pr.id, v_pr.requester_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  else
    perform set_config('app.pr_status_transition', 'UNDER_REVIEW', true);
    update public.purchase_requests set status = 'UNDER_REVIEW' where id = v_pr.id and status = 'SUBMITTED';
  end if;
end;
$$;

-- create_purchase_order_from_pr() also flips the source PR to
-- CONVERTED_TO_PO -- needs the same authorization flag.
create or replace function public.create_purchase_order_from_pr(
  p_purchase_request_id uuid,
  p_payment_terms text default null,
  p_shipping_terms text default null,
  p_expected_delivery_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pr public.purchase_requests%rowtype;
  v_q public.quotations%rowtype;
  v_po_id uuid;
  v_policy record;
  v_needs_approval boolean := false;
begin
  select * into v_pr from public.purchase_requests where id = p_purchase_request_id;
  if v_pr.id is null then raise exception 'Purchase request not found'; end if;
  if not public.has_permission(v_pr.company_id, 'IT.PROCUREMENT.CREATE_PO') then
    raise exception 'Missing permission IT.PROCUREMENT.CREATE_PO';
  end if;
  if v_pr.status <> 'APPROVED' then raise exception 'Purchase request must be approved first'; end if;

  select * into v_q from public.quotations where purchase_request_id = p_purchase_request_id and status = 'SELECTED';
  if v_q.id is null then raise exception 'No quotation has been selected for this request'; end if;

  insert into public.purchase_orders (
    company_id, purchase_request_id, quotation_id, supplier_id, expected_delivery_date,
    currency_id, payment_terms, shipping_terms, subtotal, tax, shipping, discount, total,
    exchange_rate, base_currency_id, base_currency_total, created_by
  )
  values (
    v_pr.company_id, p_purchase_request_id, v_q.id, v_q.supplier_id, p_expected_delivery_date,
    v_q.currency_id, p_payment_terms, p_shipping_terms, v_q.subtotal, v_q.tax, v_q.shipping, v_q.discount, v_q.total,
    v_q.exchange_rate, v_q.base_currency_id, v_q.base_currency_total, auth.uid()
  )
  returning id into v_po_id;

  insert into public.purchase_order_items (purchase_order_id, company_id, description, quantity, unit_price, asset_type, software_type, category)
  select v_po_id, v_pr.company_id, qi.description, qi.quantity, qi.unit_price, pri.asset_type, pri.software_type, pri.category
  from public.quotation_items qi
  left join public.purchase_request_items pri on pri.id = qi.purchase_request_item_id
  where qi.quotation_id = v_q.id;

  perform set_config('app.pr_status_transition', 'CONVERTED_TO_PO', true);
  update public.purchase_requests set status = 'CONVERTED_TO_PO' where id = p_purchase_request_id;

  if v_pr.budget_id is not null then
    insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
    values (v_pr.company_id, v_pr.budget_id, v_pr.budget_category_id, coalesce(v_pr.base_currency_amount, 0),
      coalesce(v_pr.base_currency_id, v_pr.currency_id), 'RELEASE', 'purchase_request', v_pr.id,
      'Released PR estimate on PO creation', auth.uid());
    insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
    values (v_pr.company_id, v_pr.budget_id, v_pr.budget_category_id, coalesce(v_q.base_currency_total, v_q.total),
      coalesce(v_q.base_currency_id, v_q.currency_id), 'COMMITMENT', 'purchase_order', v_po_id,
      'Committed for PO from ' || v_q.supplier_id, auth.uid());
  end if;

  perform public.log_procurement_event(v_pr.company_id, 'purchase_order', v_po_id, 'CREATED', null, 'DRAFT',
    jsonb_build_object('purchase_request_id', p_purchase_request_id, 'quotation_id', v_q.id));
  perform public.log_audit_event(v_pr.company_id, 'PURCHASE_ORDER_CREATED', 'purchase_order', v_po_id,
    jsonb_build_object('purchase_request_id', p_purchase_request_id));

  for v_policy in
    select * from public.get_applicable_approval_policies(v_pr.company_id, 'PURCHASE_ORDER', coalesce(v_q.base_currency_total, v_q.total), coalesce(v_q.base_currency_id, v_q.currency_id))
  loop
    v_needs_approval := true;
    insert into public.purchase_order_approvals (company_id, purchase_order_id, required_permission, approval_level, sequence)
    values (v_pr.company_id, v_po_id, v_policy.required_permission, v_policy.approval_sequence, v_policy.approval_sequence);
  end loop;

  update public.purchase_orders set status = case when v_needs_approval then 'PENDING_APPROVAL' else 'APPROVED' end where id = v_po_id;

  if v_needs_approval then
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (v_pr.company_id, 'PO_AWAITING_APPROVAL', 'Purchase order awaiting approval',
      (select po_number from public.purchase_orders where id = v_po_id) || ' needs approval.', 'purchase_order', v_po_id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;

  return v_po_id;
end;
$$;
