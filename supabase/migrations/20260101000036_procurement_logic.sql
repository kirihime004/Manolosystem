-- =========================================================================
-- PHASE 3: procurement workflow logic -- numbering, approval chains,
-- budget commitment/expense postings, quotation selection, PO creation,
-- delivery receiving, and inventory asset generation.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Default catch-all approval policy per company (always at least one
-- level so a company that hasn't configured tiers yet never gets stuck
-- with an unapprovable request). Company Admins can add tiered policies
-- afterward via Settings; this is just a safe floor.
-- ---------------------------------------------------------------------
create or replace function public.seed_approval_policies()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.approval_policies (company_id, module, minimum_amount, maximum_amount, required_permission, approval_sequence)
  values
    (new.id, 'PURCHASE_REQUEST', 0, null, 'IT.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_ORDER', 0, null, 'IT.PROCUREMENT.APPROVE_PO', 1);
  return new;
end;
$$;

create trigger seed_approval_policies_trigger
  after insert on public.companies
  for each row execute function public.seed_approval_policies();

create or replace function public.get_applicable_approval_policies(
  p_company_id uuid, p_module text, p_amount numeric, p_currency_id uuid
)
returns setof public.approval_policies
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.approval_policies
  where company_id = p_company_id and module = p_module and enabled
    and minimum_amount <= p_amount
    and (maximum_amount is null or p_amount <= maximum_amount)
    and (currency_id is null or currency_id = p_currency_id)
  order by approval_sequence;
$$;

-- ---------------------------------------------------------------------
-- Purchase Requests: numbering + immutability + history
-- ---------------------------------------------------------------------
create or replace function public.before_insert_purchase_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.request_number := public.generate_asset_code(new.company_id, 'PR');
  if new.requester_id is null then
    new.requester_id := auth.uid();
  end if;
  if new.requester_id <> auth.uid() and not public.is_platform_superadmin() then
    raise exception 'requester_id must be the authenticated user';
  end if;
  return new;
end;
$$;

create trigger before_insert_purchase_request_trigger
  before insert on public.purchase_requests
  for each row execute function public.before_insert_purchase_request();

create or replace function public.after_insert_purchase_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_procurement_event(new.company_id, 'purchase_request', new.id, 'CREATED', null, new.status);
  perform public.log_audit_event(new.company_id, 'PURCHASE_REQUEST_CREATED', 'purchase_request', new.id,
    jsonb_build_object('request_number', new.request_number));
  return new;
end;
$$;

create trigger after_insert_purchase_request_trigger
  after insert on public.purchase_requests
  for each row execute function public.after_insert_purchase_request();

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

  -- Status is only ever moved by submit_purchase_request() / the approval
  -- RPCs / explicit cancel -- block any other direct status jump.
  if new.status is distinct from old.status
     and not (old.status = 'DRAFT' and new.status = 'CANCELLED')
     and not (old.status in ('DRAFT') and new.status = 'SUBMITTED') then
    if new.status not in ('CANCELLED') then
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

create trigger before_update_purchase_request_trigger
  before update on public.purchase_requests
  for each row execute function public.before_update_purchase_request();

create or replace function public.after_update_purchase_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_procurement_event(new.company_id, 'purchase_request', new.id, 'STATUS_CHANGED', old.status, new.status);
    perform public.log_audit_event(new.company_id, 'PURCHASE_REQUEST_STATUS_CHANGED', 'purchase_request', new.id,
      jsonb_build_object('old_status', old.status, 'new_status', new.status));
  end if;
  return new;
end;
$$;

create trigger after_update_purchase_request_trigger
  after update on public.purchase_requests
  for each row execute function public.after_update_purchase_request();

-- ---------------------------------------------------------------------
-- Purchase request items: derive company_id
-- ---------------------------------------------------------------------
create or replace function public.derive_purchase_request_item_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.purchase_requests where id = new.purchase_request_id;
  if v_company_id is null then raise exception 'Invalid purchase_request_id'; end if;
  new.company_id := v_company_id;
  new.estimated_total := new.quantity * new.estimated_unit_price;
  return new;
end;
$$;

create trigger derive_purchase_request_item_company_id_trigger
  before insert or update on public.purchase_request_items
  for each row execute function public.derive_purchase_request_item_company_id();

-- ---------------------------------------------------------------------
-- submit_purchase_request(): budget validation + approval chain creation
-- ---------------------------------------------------------------------
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

grant execute on function public.submit_purchase_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- decide_purchase_request_approval(): the only path a PR moves to
-- APPROVED/REJECTED, enforcing sequence order and self-approval policy.
-- ---------------------------------------------------------------------
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
    update public.purchase_requests set status = 'UNDER_REVIEW' where id = v_pr.id and status = 'SUBMITTED';
  end if;
end;
$$;

grant execute on function public.decide_purchase_request_approval(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------
create or replace function public.derive_quotation_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_base_currency_id uuid;
begin
  select company_id into v_company_id from public.purchase_requests where id = new.purchase_request_id;
  if v_company_id is null then raise exception 'Invalid purchase_request_id'; end if;
  new.company_id := v_company_id;

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = v_company_id;
  new.base_currency_id := v_base_currency_id;
  new.exchange_rate := case when new.currency_id = v_base_currency_id then 1
    else public.get_exchange_rate(new.currency_id, v_base_currency_id, new.quotation_date) end;
  new.base_currency_total := case when new.exchange_rate is null then null else round(new.total * new.exchange_rate, 2) end;
  return new;
end;
$$;

create trigger derive_quotation_fields_trigger
  before insert on public.quotations
  for each row execute function public.derive_quotation_fields();

create or replace function public.after_insert_quotation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_procurement_event(new.company_id, 'quotation', new.id, 'RECEIVED', null, new.status,
    jsonb_build_object('supplier_id', new.supplier_id, 'total', new.total));
  return new;
end;
$$;

create trigger after_insert_quotation_trigger
  after insert on public.quotations
  for each row execute function public.after_insert_quotation();

create or replace function public.derive_quotation_item_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.quotations where id = new.quotation_id;
  if v_company_id is null then raise exception 'Invalid quotation_id'; end if;
  new.company_id := v_company_id;
  new.line_total := new.quantity * new.unit_price;
  return new;
end;
$$;

create trigger derive_quotation_item_company_id_trigger
  before insert or update on public.quotation_items
  for each row execute function public.derive_quotation_item_company_id();

create or replace function public.select_quotation(p_quotation_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_q public.quotations%rowtype;
begin
  select * into v_q from public.quotations where id = p_quotation_id;
  if v_q.id is null then raise exception 'Quotation not found'; end if;
  if not public.has_permission(v_q.company_id, 'IT.PROCUREMENT.UPDATE') then
    raise exception 'Missing permission IT.PROCUREMENT.UPDATE';
  end if;

  update public.quotations set status = 'UNDER_REVIEW'
  where purchase_request_id = v_q.purchase_request_id and id <> p_quotation_id and status = 'SELECTED';

  update public.quotations
  set status = 'SELECTED', selected_by = auth.uid(), selected_at = now(), selection_reason = p_reason
  where id = p_quotation_id;

  perform public.log_procurement_event(v_q.company_id, 'quotation', p_quotation_id, 'SELECTED', v_q.status, 'SELECTED',
    jsonb_build_object('supplier_id', v_q.supplier_id), p_reason);
  perform public.log_audit_event(v_q.company_id, 'SUPPLIER_SELECTED', 'quotation', p_quotation_id,
    jsonb_build_object('supplier_id', v_q.supplier_id));
end;
$$;

grant execute on function public.select_quotation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Purchase Orders
-- ---------------------------------------------------------------------
create or replace function public.before_insert_purchase_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.po_number := public.generate_asset_code(new.company_id, 'PO');
  return new;
end;
$$;

create trigger before_insert_purchase_order_trigger
  before insert on public.purchase_orders
  for each row execute function public.before_insert_purchase_order();

create or replace function public.before_update_purchase_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;
  if new.po_number <> old.po_number then raise exception 'po_number cannot be changed'; end if;

  if new.status is distinct from old.status then
    if new.status = 'APPROVED' and not public.has_permission(old.company_id, 'IT.PROCUREMENT.APPROVE_PO') then
      raise exception 'Missing permission IT.PROCUREMENT.APPROVE_PO';
    end if;
    if new.status <> 'APPROVED' and not public.has_permission(old.company_id, 'IT.PROCUREMENT.UPDATE') then
      raise exception 'Missing permission IT.PROCUREMENT.UPDATE';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_purchase_order_trigger
  before update on public.purchase_orders
  for each row execute function public.before_update_purchase_order();

create or replace function public.after_update_purchase_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    perform public.log_procurement_event(new.company_id, 'purchase_order', new.id, 'STATUS_CHANGED', old.status, new.status);
    perform public.log_audit_event(new.company_id, 'PURCHASE_ORDER_STATUS_CHANGED', 'purchase_order', new.id,
      jsonb_build_object('old_status', old.status, 'new_status', new.status));

    if new.status = 'SENT_TO_SUPPLIER' then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (new.company_id, 'PO_SENT_TO_SUPPLIER', 'Purchase order sent', new.po_number || ' was sent to the supplier.', 'purchase_order', new.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
    elsif new.status = 'APPROVED' then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (new.company_id, 'PO_APPROVED', 'Purchase order approved', new.po_number || ' has been approved.', 'purchase_order', new.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger after_update_purchase_order_trigger
  after update on public.purchase_orders
  for each row execute function public.after_update_purchase_order();

create or replace function public.derive_purchase_order_item_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.purchase_orders where id = new.purchase_order_id;
  if v_company_id is null then raise exception 'Invalid purchase_order_id'; end if;
  new.company_id := v_company_id;
  new.line_total := (new.quantity * new.unit_price) + new.tax - new.discount;
  return new;
end;
$$;

create trigger derive_purchase_order_item_company_id_trigger
  before insert on public.purchase_order_items
  for each row execute function public.derive_purchase_order_item_company_id();

-- ---------------------------------------------------------------------
-- create_purchase_order_from_pr(): the PR -> PO conversion
-- ---------------------------------------------------------------------
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

grant execute on function public.create_purchase_order_from_pr(uuid, text, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- decide_purchase_order_approval()
-- ---------------------------------------------------------------------
create or replace function public.decide_purchase_order_approval(
  p_approval_id uuid, p_decision text, p_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.purchase_order_approvals%rowtype;
  v_po public.purchase_orders%rowtype;
  v_earlier_pending integer;
  v_remaining_pending integer;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_approval from public.purchase_order_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_po from public.purchase_orders where id = v_approval.purchase_order_id;
  if v_po.status <> 'PENDING_APPROVAL' then raise exception 'Purchase order is not awaiting approval'; end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  select count(*) into v_earlier_pending from public.purchase_order_approvals
    where purchase_order_id = v_approval.purchase_order_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then raise exception 'An earlier approval level is still pending'; end if;

  update public.purchase_order_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  perform public.log_procurement_event(v_approval.company_id, 'purchase_order', v_po.id,
    case when p_decision = 'APPROVED' then 'APPROVAL_GRANTED' else 'APPROVAL_REJECTED' end,
    v_po.status, v_po.status, jsonb_build_object('sequence', v_approval.sequence), p_comments);

  if p_decision = 'REJECTED' then
    update public.purchase_orders set status = 'CANCELLED' where id = v_po.id;
    return;
  end if;

  select count(*) into v_remaining_pending from public.purchase_order_approvals
    where purchase_order_id = v_po.id and decision = 'PENDING';

  if v_remaining_pending = 0 then
    update public.purchase_orders set status = 'APPROVED', approved_by = auth.uid() where id = v_po.id;
  end if;
end;
$$;

grant execute on function public.decide_purchase_order_approval(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Deliveries / receiving -- the point where budget COMMITMENT becomes
-- EXPENSE and Phase 2 inventory assets get created.
-- ---------------------------------------------------------------------
create or replace function public.before_insert_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.purchase_orders where id = new.purchase_order_id;
  if v_company_id is null then raise exception 'Invalid purchase_order_id'; end if;
  new.company_id := v_company_id;
  new.delivery_number := public.generate_asset_code(v_company_id, 'DEL');
  if new.received_by is null then new.received_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_delivery_trigger
  before insert on public.deliveries
  for each row execute function public.before_insert_delivery();

create or replace function public.after_insert_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_procurement_event(new.company_id, 'delivery', new.id, 'CREATED', null, null,
    jsonb_build_object('purchase_order_id', new.purchase_order_id));
  return new;
end;
$$;

create trigger after_insert_delivery_trigger
  after insert on public.deliveries
  for each row execute function public.after_insert_delivery();

create or replace function public.derive_delivery_item_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_remaining numeric;
begin
  select d.company_id into v_company_id from public.deliveries d where d.id = new.delivery_id;
  if v_company_id is null then raise exception 'Invalid delivery_id'; end if;
  new.company_id := v_company_id;

  select remaining_quantity into v_remaining from public.purchase_order_items where id = new.purchase_order_item_id;
  if v_remaining is null then raise exception 'Invalid purchase_order_item_id'; end if;
  if new.quantity_received > v_remaining then
    raise exception 'Cannot receive % units -- only % remain on this order line', new.quantity_received, v_remaining;
  end if;

  return new;
end;
$$;

create trigger derive_delivery_item_company_id_trigger
  before insert on public.delivery_items
  for each row execute function public.derive_delivery_item_company_id();

-- The core receiving side-effect: bump received_quantity, roll the parent
-- PO's status up, post the budget EXPENSE (releasing the matching slice of
-- COMMITMENT), and create Phase 2 inventory assets for what physically
-- arrived. All in one AFTER INSERT so a single delivery_items row is the
-- one atomic unit of "we received N of this line."
create or replace function public.after_insert_delivery_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_poi public.purchase_order_items%rowtype;
  v_po public.purchase_orders%rowtype;
  v_pr public.purchase_requests%rowtype;
  v_delivery public.deliveries%rowtype;
  v_currency_code text;
  v_expense_amount numeric;
  v_open_lines integer;
  v_asset_id uuid;
  v_i integer;
  v_lifecycle_years integer := 5;
begin
  update public.purchase_order_items
  set received_quantity = received_quantity + new.quantity_received
  where id = new.purchase_order_item_id
  returning * into v_poi;

  select * into v_po from public.purchase_orders where id = v_poi.purchase_order_id;
  select * into v_delivery from public.deliveries where id = new.delivery_id;
  if v_po.purchase_request_id is not null then
    select * into v_pr from public.purchase_requests where id = v_po.purchase_request_id;
  end if;

  select count(*) into v_open_lines from public.purchase_order_items
  where purchase_order_id = v_po.id and remaining_quantity > 0;

  update public.purchase_orders
  set status = case when v_open_lines = 0 then 'RECEIVED' else 'PARTIALLY_RECEIVED' end
  where id = v_po.id;

  -- Budget: the received slice's value moves from Committed to Spent.
  if v_pr.budget_id is not null then
    v_expense_amount := round(new.quantity_received * v_poi.unit_price * coalesce(v_po.exchange_rate, 1), 2);

    insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
    values (v_po.company_id, v_pr.budget_id, v_pr.budget_category_id, v_expense_amount,
      coalesce(v_po.base_currency_id, v_po.currency_id), 'RELEASE', 'purchase_order', v_po.id,
      'Received against ' || v_po.po_number, auth.uid());

    insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
    values (v_po.company_id, v_pr.budget_id, v_pr.budget_category_id, v_expense_amount,
      coalesce(v_po.base_currency_id, v_po.currency_id), 'EXPENSE', 'delivery', new.delivery_id,
      'Received against ' || v_po.po_number, auth.uid());
  end if;

  select code into v_currency_code from public.currencies where id = v_po.currency_id;

  -- Inventory: hardware gets one discrete asset per unit received;
  -- software gets one asset carrying the received quantity as seats.
  if v_poi.asset_type = 'HARDWARE' then
    v_i := 0;
    while v_i < new.quantity_received loop
      insert into public.assets (company_id, asset_type, category, name, purchase_date, purchase_price, currency,
        supplier_id, purchase_order_id, purchase_order_item_id, status)
      values (v_po.company_id, 'HARDWARE', v_poi.category, v_poi.description, v_delivery.delivery_date, v_poi.unit_price,
        coalesce(v_currency_code, 'USD'), v_po.supplier_id, v_po.id, v_poi.id, 'UNASSIGNED')
      returning id into v_asset_id;

      insert into public.hardware_details (asset_id, lifecycle_years) values (v_asset_id, v_lifecycle_years);
      v_i := v_i + 1;
    end loop;
  elsif v_poi.asset_type = 'SOFTWARE' then
    insert into public.assets (company_id, asset_type, category, name, purchase_date, purchase_price, currency,
      supplier_id, purchase_order_id, purchase_order_item_id, status)
    values (v_po.company_id, 'SOFTWARE', v_poi.category, v_poi.description, v_delivery.delivery_date,
      v_poi.unit_price * new.quantity_received, coalesce(v_currency_code, 'USD'), v_po.supplier_id, v_po.id, v_poi.id, 'ACTIVE')
    returning id into v_asset_id;

    insert into public.software_details (asset_id, software_type, number_of_licenses)
    values (v_asset_id, coalesce(v_poi.software_type, 'ONE_TIME_PURCHASE'), new.quantity_received);

    if v_poi.software_type = 'SUBSCRIPTION' then
      insert into public.software_subscriptions (asset_id, subscription_start, seats_total)
      values (v_asset_id, v_delivery.delivery_date, new.quantity_received);
    end if;
  end if;

  perform public.log_procurement_event(v_po.company_id, 'delivery', new.delivery_id,
    case when v_open_lines = 0 then 'FULLY_RECEIVED' else 'PARTIALLY_RECEIVED' end,
    v_po.status, case when v_open_lines = 0 then 'RECEIVED' else 'PARTIALLY_RECEIVED' end,
    jsonb_build_object('purchase_order_item_id', new.purchase_order_item_id, 'quantity_received', new.quantity_received));

  if v_open_lines > 0 then
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (v_po.company_id, 'DELIVERY_PARTIAL', 'Partial delivery received',
      v_po.po_number || ' was partially received.', 'purchase_order', v_po.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger after_insert_delivery_item_trigger
  after insert on public.delivery_items
  for each row execute function public.after_insert_delivery_item();
