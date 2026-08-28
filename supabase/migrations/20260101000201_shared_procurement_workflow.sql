-- =========================================================================
-- SHARE PROCUREMENT ACROSS HR, FINANCE, ADMINISTRATION, AND PRODUCTION --
-- Part 4: workflow RPCs.
--
-- decide_purchase_request_approval()/decide_purchase_order_approval()
-- need NO changes -- both are already fully data-driven off each
-- approval row's own required_permission column, confirmed against
-- their current bodies (182). Only the three functions below still
-- hardcode 'IT.PROCUREMENT.*' or fail to pass a department into the
-- approval-policy lookup.
-- =========================================================================

-- get_applicable_approval_policies(): add an optional module_key filter.
-- Existing non-procurement callers (Leave, Overtime, Production Work,
-- Journal Entries, ...) keep calling it with 4 args -- untouched, since
-- their policy rows all have module_key is null and the new predicate
-- treats that as "applies regardless of department".
create or replace function public.get_applicable_approval_policies(
  p_company_id uuid, p_module text, p_amount numeric, p_currency_id uuid, p_module_key public.module_key default null
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
    and (module_key is null or module_key = p_module_key)
  order by approval_sequence;
$$;

grant execute on function public.get_applicable_approval_policies(uuid, text, numeric, uuid, public.module_key) to authenticated;

-- submit_purchase_request(): based on the current (183) body. Changes:
-- the self-submit-override permission check and the approval-policy
-- lookup now use the PR's own module_key instead of a hardcoded 'IT.'
-- string; a new ownership guard rejects submitting against a budget
-- that belongs to a different department.
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
  v_budget_status text;
  v_budget_module_key public.module_key;
begin
  select * into v_pr from public.purchase_requests where id = p_purchase_request_id;
  if v_pr.id is null then raise exception 'Purchase request not found'; end if;
  if v_pr.status <> 'DRAFT' then raise exception 'Only draft requests can be submitted'; end if;
  if v_pr.requester_id <> auth.uid()
     and not public.is_platform_superadmin()
     and not public.has_permission(v_pr.company_id, v_pr.module_key::text || '.PROCUREMENT.UPDATE') then
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
    select status, module_key into v_budget_status, v_budget_module_key from public.budgets where id = v_pr.budget_id;
    -- A department can only draw against its own budget -- nothing
    -- enforced this before Procurement was shared (when every PR and
    -- every budget were both always IT's, it was structurally
    -- impossible to get this wrong).
    if v_budget_module_key is not null and v_budget_module_key <> v_pr.module_key then
      raise exception 'This request''s budget belongs to a different department';
    end if;
    -- Only check numeric availability once the budget has something real
    -- to check against (Finance-approved). Before that, submission is
    -- preparation-only -- decide_purchase_request_approval() is the actual
    -- gate that blocks committing against an unapproved budget.
    if v_budget_status in ('APPROVED', 'ACTIVE') then
      select * into v_check from public.check_budget_availability(v_pr.budget_id, v_pr.budget_category_id, v_pr.estimated_total, v_pr.currency_id);
      if not v_check.is_available then
        raise exception 'Insufficient budget: % available, % requested (in budget currency)', v_check.available_amount, v_check.converted_amount;
      end if;
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
      v_pr.company_id, 'PURCHASE_REQUEST', round(v_pr.estimated_total * v_rate, 2), v_base_currency_id, v_pr.module_key
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

-- create_purchase_order_from_pr(): based on the current (182) body.
-- Changes: the CREATE_PO permission check and the PO's own
-- approval-policy lookup now use the PR's module_key; the new PO row
-- copies module_key from the PR, alongside department_id/project_id
-- which it already copied.
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
  if not public.has_permission(v_pr.company_id, v_pr.module_key::text || '.PROCUREMENT.CREATE_PO') then
    raise exception 'Missing permission %.PROCUREMENT.CREATE_PO', v_pr.module_key;
  end if;
  if v_pr.status <> 'APPROVED' then raise exception 'Purchase request must be approved first'; end if;

  select * into v_q from public.quotations where purchase_request_id = p_purchase_request_id and status = 'SELECTED';
  if v_q.id is null then raise exception 'No quotation has been selected for this request'; end if;

  insert into public.purchase_orders (
    company_id, purchase_request_id, quotation_id, supplier_id, expected_delivery_date,
    currency_id, payment_terms, shipping_terms, subtotal, tax, shipping, discount, total,
    exchange_rate, base_currency_id, base_currency_total, created_by,
    department_id, cost_center_id, project_id, module_key
  )
  values (
    v_pr.company_id, p_purchase_request_id, v_q.id, v_q.supplier_id, p_expected_delivery_date,
    v_q.currency_id, p_payment_terms, p_shipping_terms, v_q.subtotal, v_q.tax, v_q.shipping, v_q.discount, v_q.total,
    v_q.exchange_rate, v_q.base_currency_id, v_q.base_currency_total, auth.uid(),
    v_pr.department_id, null, v_pr.production_project_id, v_pr.module_key
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
    select * from public.get_applicable_approval_policies(v_pr.company_id, 'PURCHASE_ORDER', coalesce(v_q.base_currency_total, v_q.total), coalesce(v_q.base_currency_id, v_q.currency_id), v_pr.module_key)
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
