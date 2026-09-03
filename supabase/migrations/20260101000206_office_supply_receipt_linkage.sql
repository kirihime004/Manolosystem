-- Second full-app gap audit, architectural item 3a: OFFICE_SUPPLY delivery
-- receipts still create no inventory record -- migration 205 deliberately
-- left this out because purchase_request_items/purchase_order_items had no
-- link to a specific public.office_supplies catalog row (see that
-- migration's header comment). This adds that link and wires the receiving
-- side.

alter table public.purchase_request_items
  add column if not exists office_supply_id uuid references public.office_supplies(id) on delete set null;
alter table public.purchase_order_items
  add column if not exists office_supply_id uuid references public.office_supplies(id) on delete set null;

create index if not exists purchase_request_items_office_supply_idx on public.purchase_request_items (office_supply_id);
create index if not exists purchase_order_items_office_supply_idx on public.purchase_order_items (office_supply_id);

-- create_purchase_order_from_pr() copies purchase_order_items from
-- quotation_items joined back to purchase_request_items -- extend that
-- copy to carry office_supply_id across too, same as asset_type/category.
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

  insert into public.purchase_order_items (purchase_order_id, company_id, description, quantity, unit_price, asset_type, software_type, category, office_supply_id)
  select v_po_id, v_pr.company_id, qi.description, qi.quantity, qi.unit_price, pri.asset_type, pri.software_type, pri.category, pri.office_supply_id
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

-- Extend the receiving trigger with an OFFICE_SUPPLY branch. Can't call
-- record_supply_movement() directly here -- it's permission-gated on
-- ADMIN.SUPPLIES.MANAGE, which whoever is recording an IT/procurement
-- delivery has no reason to hold -- so this inlines the same STOCK_IN
-- credit + ledger-row + low-stock-notification logic that RPC uses,
-- against public.office_supplies directly (this trigger is already
-- security definer). If office_supply_id is null (legacy/free-text rows
-- with no catalog link), nothing is credited -- guessing a match risks
-- corrupting the wrong item's stock.
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
  v_supply public.office_supplies%rowtype;
  v_new_quantity numeric;
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
  -- software gets one asset carrying the received quantity as seats;
  -- admin assets also get one discrete admin_assets row per unit received;
  -- office supplies credit the catalog's running quantity instead of
  -- creating discrete asset rows.
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
  elsif v_poi.asset_type = 'ADMIN_ASSET' then
    v_i := 0;
    while v_i < new.quantity_received loop
      insert into public.admin_assets (company_id, name, category, status, condition, purchase_date, purchase_price,
        currency_id, supplier_id, purchase_order_id, purchase_order_item_id)
      values (v_po.company_id, v_poi.description, v_poi.category, 'AVAILABLE', 'NEW', v_delivery.delivery_date,
        v_poi.unit_price, v_po.currency_id, v_po.supplier_id, v_po.id, v_poi.id);
      v_i := v_i + 1;
    end loop;
  elsif v_poi.asset_type = 'OFFICE_SUPPLY' and v_poi.office_supply_id is not null then
    select * into v_supply from public.office_supplies where id = v_poi.office_supply_id for update;
    if v_supply.id is not null then
      v_new_quantity := v_supply.current_quantity + new.quantity_received;

      insert into public.office_supply_movements (
        company_id, supply_id, movement_type, quantity, previous_quantity, new_quantity,
        reference_type, reference_id, performed_by, reason
      ) values (
        v_supply.company_id, v_supply.id, 'STOCK_IN', new.quantity_received, v_supply.current_quantity, v_new_quantity,
        'delivery', new.delivery_id, auth.uid(), 'Received against ' || v_po.po_number
      );

      update public.office_supplies set current_quantity = v_new_quantity where id = v_supply.id;

      if v_new_quantity <= v_supply.minimum_quantity then
        insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
        select distinct v_supply.company_id, 'LOW_OFFICE_STOCK', 'Low stock -- reorder required',
          v_supply.name || ' is at ' || v_new_quantity || ' ' || v_supply.unit || ' (minimum ' || v_supply.minimum_quantity || ')',
          'office_supply', v_supply.id
        on conflict (company_id, type, resource_type, resource_id) do nothing;
      end if;
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
