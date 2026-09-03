-- Phase 1f of the full-app gap audit: a delivery received against a PO line
-- with asset_type = 'ADMIN_ASSET' currently creates no inventory record at
-- all -- the receiving trigger only ever branched on HARDWARE/SOFTWARE, both
-- of which live in public.assets. Admin's own asset register is a separate
-- table (public.admin_assets, see 20260101000111_admin_assets_schema.sql)
-- that had no PO-linkage columns, so this adds them (mirroring assets'
-- purchase_order_id/purchase_order_item_id) and extends the trigger with a
-- matching branch.
--
-- OFFICE_SUPPLY is intentionally NOT handled here: a purchase_order_items
-- row has no link today to a specific public.office_supplies catalog row,
-- so there is no deterministic target to credit stock into. Guessing that
-- link silently (e.g. by matching on name) risks corrupting quantities on
-- the wrong catalog item -- it needs a real FK added at request/PO-line
-- creation time, decided separately.

alter table public.admin_assets
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  add column if not exists purchase_order_item_id uuid references public.purchase_order_items(id) on delete set null;

create index if not exists admin_assets_purchase_order_idx on public.admin_assets (purchase_order_id);

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
  -- software gets one asset carrying the received quantity as seats;
  -- admin assets (office furniture, equipment, etc. tracked outside IT's
  -- register) also get one discrete admin_assets row per unit received.
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
