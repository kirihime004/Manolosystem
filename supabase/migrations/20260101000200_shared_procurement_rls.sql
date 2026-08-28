-- =========================================================================
-- SHARE PROCUREMENT ACROSS HR, FINANCE, ADMINISTRATION, AND PRODUCTION --
-- Part 3: RLS. Mirrors 20260101000176's exact can_view_budget()/
-- can_edit_budget() rewrite -- build the permission string from the
-- row's own module_key instead of hardcoding 'IT.PROCUREMENT.*'.
-- =========================================================================

create or replace function public.can_view_procurement(p_company_id uuid, p_module_key public.module_key)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.has_company_access(p_company_id)
    and public.has_module_enabled(p_company_id, 'PROCUREMENT')
    and public.has_permission(p_company_id, p_module_key::text || '.PROCUREMENT.VIEW');
$$;

create or replace function public.can_edit_procurement(p_company_id uuid, p_module_key public.module_key, p_action text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.has_company_access(p_company_id)
    and public.has_module_enabled(p_company_id, 'PROCUREMENT')
    and public.has_permission(p_company_id, p_module_key::text || '.PROCUREMENT.' || p_action);
$$;

grant execute on function public.can_view_procurement(uuid, public.module_key) to authenticated;
grant execute on function public.can_edit_procurement(uuid, public.module_key, text) to authenticated;

-- ---------------------------------------------------------------------
-- can_view_purchase_request(): now module_key-aware.
-- ---------------------------------------------------------------------
create or replace function public.can_view_purchase_request(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.purchase_requests pr
    where pr.id = p_id
      and public.has_company_access(pr.company_id)
      and public.has_module_enabled(pr.company_id, 'PROCUREMENT')
      and (pr.requester_id = auth.uid() or public.has_permission(pr.company_id, pr.module_key::text || '.PROCUREMENT.VIEW'))
  );
$$;

-- ---------------------------------------------------------------------
-- Purchase Requests
-- ---------------------------------------------------------------------
drop policy "purchase_requests_select" on public.purchase_requests;
create policy "purchase_requests_select" on public.purchase_requests
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (requester_id = auth.uid() or public.has_permission(company_id, module_key::text || '.PROCUREMENT.VIEW'))
  );
drop policy "purchase_requests_insert" on public.purchase_requests;
create policy "purchase_requests_insert" on public.purchase_requests
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and requester_id = auth.uid()
    and public.has_permission(company_id, module_key::text || '.PROCUREMENT.CREATE')
  );
drop policy "purchase_requests_update" on public.purchase_requests;
create policy "purchase_requests_update" on public.purchase_requests
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (
      (requester_id = auth.uid() and status = 'DRAFT')
      or public.has_permission(company_id, module_key::text || '.PROCUREMENT.UPDATE')
    )
  )
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT'));
drop policy "purchase_requests_delete" on public.purchase_requests;
create policy "purchase_requests_delete" on public.purchase_requests
  for delete using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and public.has_permission(company_id, module_key::text || '.PROCUREMENT.DELETE')
  );

drop policy "purchase_request_items_insert" on public.purchase_request_items;
create policy "purchase_request_items_insert" on public.purchase_request_items
  for insert with check (
    public.can_view_purchase_request(purchase_request_id)
    and (
      exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid() and pr.status = 'DRAFT')
      or public.can_edit_procurement(company_id, (select pr.module_key from public.purchase_requests pr where pr.id = purchase_request_id), 'UPDATE')
    )
  );
drop policy "purchase_request_items_update" on public.purchase_request_items;
create policy "purchase_request_items_update" on public.purchase_request_items
  for update using (
    public.can_view_purchase_request(purchase_request_id)
    and (
      exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid() and pr.status = 'DRAFT')
      or public.can_edit_procurement(company_id, (select pr.module_key from public.purchase_requests pr where pr.id = purchase_request_id), 'UPDATE')
    )
  );
drop policy "purchase_request_items_delete" on public.purchase_request_items;
create policy "purchase_request_items_delete" on public.purchase_request_items
  for delete using (
    public.can_view_purchase_request(purchase_request_id)
    and (
      exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid() and pr.status = 'DRAFT')
      or public.can_edit_procurement(company_id, (select pr.module_key from public.purchase_requests pr where pr.id = purchase_request_id), 'UPDATE')
    )
  );
-- purchase_request_items_select is unchanged (already just can_view_purchase_request(...), which is now module_key-aware internally).

drop policy "purchase_request_approvals_select" on public.purchase_request_approvals;
create policy "purchase_request_approvals_select" on public.purchase_request_approvals
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (
      approver_id = auth.uid()
      or public.has_permission(company_id, (select pr.module_key from public.purchase_requests pr where pr.id = purchase_request_id)::text || '.PROCUREMENT.VIEW')
      or exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------
drop policy "quotations_select" on public.quotations;
create policy "quotations_select" on public.quotations
  for select using (public.can_view_purchase_request(purchase_request_id));
drop policy "quotations_insert" on public.quotations;
create policy "quotations_insert" on public.quotations
  for insert with check (
    public.can_view_purchase_request(purchase_request_id)
    and public.can_edit_procurement(company_id, (select pr.module_key from public.purchase_requests pr where pr.id = purchase_request_id), 'CREATE')
  );
drop policy "quotations_update" on public.quotations;
create policy "quotations_update" on public.quotations
  for update using (
    public.can_view_purchase_request(purchase_request_id)
    and public.can_edit_procurement(company_id, (select pr.module_key from public.purchase_requests pr where pr.id = purchase_request_id), 'UPDATE')
  );

drop policy "quotation_items_select" on public.quotation_items;
create policy "quotation_items_select" on public.quotation_items
  for select using (public.has_company_access(company_id) and exists (
    select 1 from public.quotations q where q.id = quotation_id and public.can_view_purchase_request(q.purchase_request_id)
  ));
drop policy "quotation_items_insert" on public.quotation_items;
create policy "quotation_items_insert" on public.quotation_items
  for insert with check (public.has_company_access(company_id) and exists (
    select 1 from public.quotations q where q.id = quotation_id
      and public.can_edit_procurement(q.company_id, (select pr.module_key from public.purchase_requests pr where pr.id = q.purchase_request_id), 'CREATE')
  ));
drop policy "quotation_items_update" on public.quotation_items;
create policy "quotation_items_update" on public.quotation_items
  for update using (public.has_company_access(company_id) and exists (
    select 1 from public.quotations q where q.id = quotation_id
      and public.can_edit_procurement(q.company_id, (select pr.module_key from public.purchase_requests pr where pr.id = q.purchase_request_id), 'UPDATE')
  ));

-- ---------------------------------------------------------------------
-- Purchase Orders
-- ---------------------------------------------------------------------
drop policy "purchase_orders_select" on public.purchase_orders;
create policy "purchase_orders_select" on public.purchase_orders
  for select using (public.can_view_procurement(company_id, module_key));
drop policy "purchase_orders_insert" on public.purchase_orders;
create policy "purchase_orders_insert" on public.purchase_orders
  for insert with check (public.can_edit_procurement(company_id, module_key, 'CREATE_PO'));
drop policy "purchase_orders_update" on public.purchase_orders;
create policy "purchase_orders_update" on public.purchase_orders
  for update using (
    public.can_edit_procurement(company_id, module_key, 'UPDATE') or public.can_edit_procurement(company_id, module_key, 'APPROVE_PO')
  );

drop policy "purchase_order_items_select" on public.purchase_order_items;
create policy "purchase_order_items_select" on public.purchase_order_items
  for select using (exists (
    select 1 from public.purchase_orders po where po.id = purchase_order_id and public.can_view_procurement(po.company_id, po.module_key)
  ));
drop policy "purchase_order_items_insert" on public.purchase_order_items;
create policy "purchase_order_items_insert" on public.purchase_order_items
  for insert with check (exists (
    select 1 from public.purchase_orders po where po.id = purchase_order_id and public.can_edit_procurement(po.company_id, po.module_key, 'CREATE_PO')
  ));

drop policy "purchase_order_approvals_select" on public.purchase_order_approvals;
create policy "purchase_order_approvals_select" on public.purchase_order_approvals
  for select using (
    public.has_company_access(company_id)
    and (
      approver_id = auth.uid()
      or exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and public.can_view_procurement(po.company_id, po.module_key))
    )
  );

-- ---------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------
drop policy "deliveries_select" on public.deliveries;
create policy "deliveries_select" on public.deliveries
  for select using (exists (
    select 1 from public.purchase_orders po where po.id = purchase_order_id
      and (public.can_view_procurement(po.company_id, po.module_key) or public.can_edit_procurement(po.company_id, po.module_key, 'RECEIVE'))
  ));
drop policy "deliveries_insert" on public.deliveries;
create policy "deliveries_insert" on public.deliveries
  for insert with check (exists (
    select 1 from public.purchase_orders po where po.id = purchase_order_id and public.can_edit_procurement(po.company_id, po.module_key, 'RECEIVE')
  ));

drop policy "delivery_items_select" on public.delivery_items;
create policy "delivery_items_select" on public.delivery_items
  for select using (exists (
    select 1 from public.deliveries d join public.purchase_orders po on po.id = d.purchase_order_id
    where d.id = delivery_id
      and (public.can_view_procurement(po.company_id, po.module_key) or public.can_edit_procurement(po.company_id, po.module_key, 'RECEIVE'))
  ));
drop policy "delivery_items_insert" on public.delivery_items;
create policy "delivery_items_insert" on public.delivery_items
  for insert with check (exists (
    select 1 from public.deliveries d join public.purchase_orders po on po.id = d.purchase_order_id
    where d.id = delivery_id and public.can_edit_procurement(po.company_id, po.module_key, 'RECEIVE')
  ));

-- ---------------------------------------------------------------------
-- Procurement history: polymorphic (resource_type/resource_id, no
-- direct FK), so it can't join to one parent's module_key per row --
-- widened the same OR-chain way budget_categories was (176), visible to
-- anyone holding ANY department's procurement VIEW permission, same as
-- how a shared, non-department-owned catalog is treated elsewhere.
-- ---------------------------------------------------------------------
drop policy "procurement_history_select" on public.procurement_history;
create policy "procurement_history_select" on public.procurement_history
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (
      public.has_permission(company_id, 'IT.PROCUREMENT.VIEW') or public.has_permission(company_id, 'HR.PROCUREMENT.VIEW')
      or public.has_permission(company_id, 'FINANCE.PROCUREMENT.VIEW') or public.has_permission(company_id, 'ADMIN.PROCUREMENT.VIEW')
      or public.has_permission(company_id, 'PRODUCTION.PROCUREMENT.VIEW')
    )
  );

-- ---------------------------------------------------------------------
-- Approval policies: same shared-catalog treatment (a company's
-- approval_policies table is read company-wide already, and the actual
-- decision RPCs check the row's own required_permission -- this is just
-- "can this person see the configured policies at all").
-- ---------------------------------------------------------------------
drop policy "approval_policies_select" on public.approval_policies;
create policy "approval_policies_select" on public.approval_policies
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (
      public.has_permission(company_id, 'IT.PROCUREMENT.VIEW') or public.has_permission(company_id, 'HR.PROCUREMENT.VIEW')
      or public.has_permission(company_id, 'FINANCE.PROCUREMENT.VIEW') or public.has_permission(company_id, 'ADMIN.PROCUREMENT.VIEW')
      or public.has_permission(company_id, 'PRODUCTION.PROCUREMENT.VIEW')
    )
  );
drop policy "approval_policies_insert" on public.approval_policies;
create policy "approval_policies_insert" on public.approval_policies
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));
drop policy "approval_policies_update" on public.approval_policies;
create policy "approval_policies_update" on public.approval_policies
  for update using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));
drop policy "approval_policies_delete" on public.approval_policies;
create policy "approval_policies_delete" on public.approval_policies
  for delete using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));

-- ---------------------------------------------------------------------
-- Suppliers: genuinely company-wide (no department owner -- a supplier
-- isn't "HR's" or "IT's"), so no module_key column, same treatment as
-- budget_categories (176): OR-chain every department's own VIEW
-- permission for SELECT. CREATE/UPDATE/DELETE stay narrow -- vendor
-- management stays centralized to IT and Admin even though every
-- department can now browse the list to build a quotation.
-- ---------------------------------------------------------------------
drop policy "suppliers_select" on public.suppliers;
create policy "suppliers_select" on public.suppliers
  for select using (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and (
      public.has_permission(company_id, 'IT.SUPPLIERS.VIEW') or public.has_permission(company_id, 'HR.SUPPLIERS.VIEW')
      or public.has_permission(company_id, 'FINANCE.SUPPLIERS.VIEW') or public.has_permission(company_id, 'ADMIN.SUPPLIERS.VIEW')
      or public.has_permission(company_id, 'PRODUCTION.SUPPLIERS.VIEW')
    )
  );
-- CREATE/UPDATE/DELETE: narrowly widened to also let Admin manage the
-- shared vendor catalog (Admin already owns Facilities/Assets/Vehicles/
-- Contracts, all of which reference suppliers) -- IT keeps its existing
-- access, no other department gets write access to the catalog itself.
drop policy "suppliers_insert" on public.suppliers;
create policy "suppliers_insert" on public.suppliers
  for insert with check (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and (public.has_permission(company_id, 'IT.SUPPLIERS.CREATE') or public.has_permission(company_id, 'ADMIN.SUPPLIERS.CREATE'))
  );
drop policy "suppliers_update" on public.suppliers;
create policy "suppliers_update" on public.suppliers
  for update using (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and (public.has_permission(company_id, 'IT.SUPPLIERS.UPDATE') or public.has_permission(company_id, 'ADMIN.SUPPLIERS.UPDATE'))
  );
drop policy "suppliers_delete" on public.suppliers;
create policy "suppliers_delete" on public.suppliers
  for delete using (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and (public.has_permission(company_id, 'IT.SUPPLIERS.DELETE') or public.has_permission(company_id, 'ADMIN.SUPPLIERS.DELETE'))
  );
