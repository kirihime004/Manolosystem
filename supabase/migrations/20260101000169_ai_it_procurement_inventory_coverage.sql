-- =========================================================================
-- Fix: the AI layer has zero coverage of Procurement -- no tool, no RPC
-- field, nothing -- despite IT.NOTIFICATIONS.VIEW/the sidebar/the whole
-- rest of the app treating Inventory+Procurement as part of the IT
-- department bucket. A user asking the assistant "what purchase requests
-- are waiting on me" or "are there POs I still need to bill" gets nothing.
--
-- Fix: extend get_it_dashboard_summary() (already gated on
-- AI.IT_ANALYTICS.VIEW, the existing IT-department-wide analytics
-- permission -- no new permission needed, matching how this app already
-- treats Inventory/Procurement as part of "IT" everywhere else) with
-- three counts: purchase requests awaiting review, purchase orders
-- awaiting approval, and purchase orders that have received goods not
-- yet reflected in a supplier bill (the exact backlog
-- create_supplier_bill_from_po, migration 165, exists to clear).
-- =========================================================================

drop function public.get_it_dashboard_summary(uuid);

create function public.get_it_dashboard_summary(p_company_id uuid)
returns table (
  open_tickets bigint,
  critical_tickets bigint,
  tickets_resolved_30d bigint,
  assets_in_repair bigint,
  assets_needing_replacement bigint,
  software_renewals_30d bigint,
  pending_purchase_requests bigint,
  pos_awaiting_approval bigint,
  pos_with_unbilled_receipts bigint
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_company_id, 'AI.IT_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  return query select
    (select count(*) from public.tickets
      where company_id = p_company_id and status not in ('RESOLVED', 'CLOSED', 'CANCELLED')),
    (select count(*) from public.tickets
      where company_id = p_company_id and status not in ('RESOLVED', 'CLOSED', 'CANCELLED') and priority = 'CRITICAL'),
    (select count(*) from public.tickets
      where company_id = p_company_id and resolved_at >= now() - interval '30 days'),
    (select count(*) from public.assets where company_id = p_company_id and status = 'REPAIR'),
    (select count(*) from public.assets a
      join public.hardware_details h on h.asset_id = a.id
      where a.company_id = p_company_id and a.asset_type = 'HARDWARE' and a.status = 'ACTIVE'
        and a.purchase_date is not null and h.lifecycle_years is not null
        and a.purchase_date + (h.lifecycle_years || ' years')::interval <= now()),
    (select count(*) from public.software_subscriptions ss
      join public.assets a on a.id = ss.asset_id
      where a.company_id = p_company_id and ss.renewal_date between current_date and current_date + 30),
    (select count(*) from public.purchase_requests
      where company_id = p_company_id and status in ('SUBMITTED', 'UNDER_REVIEW')),
    (select count(*) from public.purchase_orders
      where company_id = p_company_id and status = 'PENDING_APPROVAL'),
    (select count(distinct po.id) from public.purchase_orders po
      join public.purchase_order_items poi on poi.purchase_order_id = po.id
      where po.company_id = p_company_id and po.status in ('RECEIVED', 'PARTIALLY_RECEIVED')
        and poi.received_quantity > coalesce((
          select sum(bi.quantity) from public.supplier_bill_items bi
          join public.supplier_bills b on b.id = bi.supplier_bill_id
          where bi.purchase_order_item_id = poi.id and b.status <> 'VOID'
        ), 0));
end;
$$;

grant execute on function public.get_it_dashboard_summary(uuid) to authenticated;
