-- =========================================================================
-- Bridges IT Procurement receiving into Finance AP. Until now
-- `supplier_bills.purchase_order_id` and three-way-match support existed
-- in the schema but nothing ever created a bill from a received PO --
-- a company had to key the same purchase in twice. This adds one RPC that
-- creates a DRAFT bill (never auto-approved -- a human still reviews the
-- real supplier invoice against it) pre-populated from whatever's been
-- received but not yet billed on that PO, so repeated partial deliveries
-- against one PO can each get their own bill without double-billing
-- quantities already invoiced.
-- =========================================================================
create or replace function public.create_supplier_bill_from_po(
  p_company_id uuid, p_purchase_order_id uuid, p_bill_date date default current_date, p_due_date date default (current_date + 30)
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_po public.purchase_orders;
  v_bill_id uuid;
  v_item record;
  v_already_billed numeric;
  v_unbilled numeric;
  v_any_items boolean := false;
begin
  if not public.has_permission(p_company_id, 'FINANCE.AP.CREATE') then
    raise exception 'Access denied';
  end if;

  select * into v_po from public.purchase_orders where id = p_purchase_order_id and company_id = p_company_id;
  if v_po.id is null then raise exception 'Purchase order not found'; end if;
  if v_po.status not in ('RECEIVED', 'PARTIALLY_RECEIVED') then
    raise exception 'This purchase order has not received anything yet -- nothing to bill.';
  end if;

  insert into public.supplier_bills (company_id, supplier_id, purchase_order_id, bill_date, due_date, currency_id)
  values (p_company_id, v_po.supplier_id, v_po.id, p_bill_date, p_due_date, v_po.currency_id)
  returning id into v_bill_id;

  for v_item in select * from public.purchase_order_items where purchase_order_id = v_po.id order by created_at loop
    select coalesce(sum(bi.quantity), 0) into v_already_billed
    from public.supplier_bill_items bi
    join public.supplier_bills b on b.id = bi.supplier_bill_id
    where bi.purchase_order_item_id = v_item.id and b.status <> 'VOID';

    v_unbilled := v_item.received_quantity - v_already_billed;

    if v_unbilled > 0 then
      v_any_items := true;
      insert into public.supplier_bill_items (supplier_bill_id, description, quantity, unit_price, tax, discount, purchase_order_item_id)
      values (
        v_bill_id, v_item.description, v_unbilled, v_item.unit_price,
        round(v_item.tax * (v_unbilled / nullif(v_item.quantity, 0)), 2),
        round(v_item.discount * (v_unbilled / nullif(v_item.quantity, 0)), 2),
        v_item.id
      );
    end if;
  end loop;

  if not v_any_items then
    delete from public.supplier_bills where id = v_bill_id;
    raise exception 'Nothing left to bill on this purchase order -- everything received has already been billed.';
  end if;

  perform public.log_audit_event(p_company_id, 'BILL_CREATED_FROM_PO', 'supplier_bill', v_bill_id,
    jsonb_build_object('purchase_order_id', v_po.id, 'po_number', v_po.po_number));

  return v_bill_id;
end;
$$;

grant execute on function public.create_supplier_bill_from_po(uuid, uuid, date, date) to authenticated;
