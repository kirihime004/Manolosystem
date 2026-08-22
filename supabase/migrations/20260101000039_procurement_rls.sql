-- =========================================================================
-- PHASE 3: RLS for currency + budget + procurement tables.
-- =========================================================================

-- Backfill PROCUREMENT module onto every existing company (disabled by
-- default, same pattern as INVENTORY in Phase 2).
insert into public.company_modules (company_id, module_key, enabled)
select c.id, 'PROCUREMENT', false
from public.companies c
on conflict (company_id, module_key) do nothing;

-- ---------------------------------------------------------------------
-- Currencies: global platform-managed catalog, readable by everyone,
-- writable only by Platform Superadmin (same trust level as `permissions`).
-- ---------------------------------------------------------------------
create policy "currencies_select" on public.currencies
  for select using (true);
create policy "currencies_write" on public.currencies
  for all using (public.is_platform_superadmin()) with check (public.is_platform_superadmin());

create policy "company_currency_settings_select" on public.company_currency_settings
  for select using (public.has_company_access(company_id));
create policy "company_currency_settings_update" on public.company_currency_settings
  for update using (public.has_company_access(company_id) and public.has_permission(company_id, 'IT.CURRENCY.MANAGE'));

-- Exchange rates are global/shared, but writable by anyone holding
-- IT.CURRENCY.UPDATE_RATES in ANY company they belong to -- see
-- has_any_permission() in the currency schema migration.
create policy "exchange_rates_select" on public.exchange_rates
  for select using (true);
create policy "exchange_rates_insert" on public.exchange_rates
  for insert with check (public.has_any_permission('IT.CURRENCY.UPDATE_RATES'));
create policy "exchange_rates_update" on public.exchange_rates
  for update using (public.has_any_permission('IT.CURRENCY.UPDATE_RATES'));

-- ---------------------------------------------------------------------
-- Budgets
-- ---------------------------------------------------------------------
create policy "budgets_select" on public.budgets
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.VIEW'));
create policy "budgets_insert" on public.budgets
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.CREATE'));
create policy "budgets_update" on public.budgets
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (public.has_permission(company_id, 'IT.BUDGET.UPDATE') or public.has_permission(company_id, 'IT.BUDGET.CLOSE'))
  );
create policy "budgets_delete" on public.budgets
  for delete using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.DELETE'));

create or replace function public.before_update_budget()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'CLOSED' and old.status <> 'CLOSED' and not public.has_permission(old.company_id, 'IT.BUDGET.CLOSE') then
    raise exception 'Missing permission IT.BUDGET.CLOSE';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_budget_trigger
  before update on public.budgets
  for each row execute function public.before_update_budget();

create policy "budget_categories_select" on public.budget_categories
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.VIEW'));
create policy "budget_categories_insert" on public.budget_categories
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.CREATE'));
create policy "budget_categories_update" on public.budget_categories
  for update using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.UPDATE'));
create policy "budget_categories_delete" on public.budget_categories
  for delete using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.UPDATE') and not is_system);

create policy "budget_allocations_select" on public.budget_allocations
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.VIEW'));
create policy "budget_allocations_insert" on public.budget_allocations
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.UPDATE'));
create policy "budget_allocations_update" on public.budget_allocations
  for update using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.UPDATE'));
create policy "budget_allocations_delete" on public.budget_allocations
  for delete using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.UPDATE'));

-- Transactions: read-only for clients -- only SECURITY DEFINER workflow
-- functions ever write here, so totals can never be hand-edited.
create policy "budget_transactions_select" on public.budget_transactions
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.VIEW'));

create policy "budget_alert_thresholds_select" on public.budget_alert_thresholds
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.VIEW'));
create policy "budget_alert_thresholds_update" on public.budget_alert_thresholds
  for update using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.BUDGET.UPDATE'));

-- ---------------------------------------------------------------------
-- Purchase Requests -- an employee always sees their own; broader
-- visibility needs IT.PROCUREMENT.VIEW (financial data stays need-to-know
-- by default, per spec).
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
      and (pr.requester_id = auth.uid() or public.has_permission(pr.company_id, 'IT.PROCUREMENT.VIEW'))
  );
$$;

grant execute on function public.can_view_purchase_request(uuid) to authenticated;

create policy "purchase_requests_select" on public.purchase_requests
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (requester_id = auth.uid() or public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'))
  );
create policy "purchase_requests_insert" on public.purchase_requests
  for insert with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and requester_id = auth.uid()
    and public.has_permission(company_id, 'IT.PROCUREMENT.CREATE')
  );
create policy "purchase_requests_update" on public.purchase_requests
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (
      (requester_id = auth.uid() and status = 'DRAFT')
      or public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE')
    )
  )
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT'));
create policy "purchase_requests_delete" on public.purchase_requests
  for delete using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and public.has_permission(company_id, 'IT.PROCUREMENT.DELETE')
  );

create policy "purchase_request_items_select" on public.purchase_request_items
  for select using (public.can_view_purchase_request(purchase_request_id));
create policy "purchase_request_items_insert" on public.purchase_request_items
  for insert with check (
    public.can_view_purchase_request(purchase_request_id)
    and (
      exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid() and pr.status = 'DRAFT')
      or public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE')
    )
  );
create policy "purchase_request_items_update" on public.purchase_request_items
  for update using (
    public.can_view_purchase_request(purchase_request_id)
    and (
      exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid() and pr.status = 'DRAFT')
      or public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE')
    )
  );
create policy "purchase_request_items_delete" on public.purchase_request_items
  for delete using (
    public.can_view_purchase_request(purchase_request_id)
    and (
      exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid() and pr.status = 'DRAFT')
      or public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE')
    )
  );

create policy "purchase_request_approvals_select" on public.purchase_request_approvals
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (
      approver_id = auth.uid()
      or public.has_permission(company_id, 'IT.PROCUREMENT.VIEW')
      or exists (select 1 from public.purchase_requests pr where pr.id = purchase_request_id and pr.requester_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------
create policy "quotations_select" on public.quotations
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'));
create policy "quotations_insert" on public.quotations
  for insert with check (public.can_view_purchase_request(purchase_request_id) and public.has_permission(company_id, 'IT.PROCUREMENT.CREATE'));
create policy "quotations_update" on public.quotations
  for update using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));

create policy "quotation_items_select" on public.quotation_items
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'));
create policy "quotation_items_insert" on public.quotation_items
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.CREATE'));
create policy "quotation_items_update" on public.quotation_items
  for update using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));

-- ---------------------------------------------------------------------
-- Purchase Orders
-- ---------------------------------------------------------------------
create policy "purchase_orders_select" on public.purchase_orders
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'));
create policy "purchase_orders_insert" on public.purchase_orders
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.CREATE_PO'));
create policy "purchase_orders_update" on public.purchase_orders
  for update using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE') or public.has_permission(company_id, 'IT.PROCUREMENT.APPROVE_PO'))
  );

create policy "purchase_order_items_select" on public.purchase_order_items
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'));
create policy "purchase_order_items_insert" on public.purchase_order_items
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.CREATE_PO'));

create policy "purchase_order_approvals_select" on public.purchase_order_approvals
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (approver_id = auth.uid() or public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'))
  );

-- ---------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------
create policy "deliveries_select" on public.deliveries
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (public.has_permission(company_id, 'IT.PROCUREMENT.VIEW') or public.has_permission(company_id, 'IT.PROCUREMENT.RECEIVE'))
  );
create policy "deliveries_insert" on public.deliveries
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.RECEIVE'));

create policy "delivery_items_select" on public.delivery_items
  for select using (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT')
    and (public.has_permission(company_id, 'IT.PROCUREMENT.VIEW') or public.has_permission(company_id, 'IT.PROCUREMENT.RECEIVE'))
  );
create policy "delivery_items_insert" on public.delivery_items
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.RECEIVE'));

-- ---------------------------------------------------------------------
-- Procurement history: read-only, mirrors asset_history.
-- ---------------------------------------------------------------------
create policy "procurement_history_select" on public.procurement_history
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'));

-- ---------------------------------------------------------------------
-- Approval policies
-- ---------------------------------------------------------------------
create policy "approval_policies_select" on public.approval_policies
  for select using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.VIEW'));
create policy "approval_policies_insert" on public.approval_policies
  for insert with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));
create policy "approval_policies_update" on public.approval_policies
  for update using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));
create policy "approval_policies_delete" on public.approval_policies
  for delete using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PROCUREMENT') and public.has_permission(company_id, 'IT.PROCUREMENT.UPDATE'));

-- ---------------------------------------------------------------------
-- Suppliers now serve both Inventory and Procurement -- re-scope their
-- Phase 2 policies (IT.INVENTORY.*) onto the new, more specific
-- IT.SUPPLIERS.* permissions, visible if EITHER module that uses them
-- is enabled.
-- ---------------------------------------------------------------------
drop policy "suppliers_select" on public.suppliers;
create policy "suppliers_select" on public.suppliers
  for select using (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and public.has_permission(company_id, 'IT.SUPPLIERS.VIEW')
  );
drop policy "suppliers_insert" on public.suppliers;
create policy "suppliers_insert" on public.suppliers
  for insert with check (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and public.has_permission(company_id, 'IT.SUPPLIERS.CREATE')
  );
drop policy "suppliers_update" on public.suppliers;
create policy "suppliers_update" on public.suppliers
  for update using (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and public.has_permission(company_id, 'IT.SUPPLIERS.UPDATE')
  );
drop policy "suppliers_delete" on public.suppliers;
create policy "suppliers_delete" on public.suppliers
  for delete using (
    public.has_company_access(company_id)
    and (public.has_module_enabled(company_id, 'INVENTORY') or public.has_module_enabled(company_id, 'PROCUREMENT'))
    and public.has_permission(company_id, 'IT.SUPPLIERS.DELETE')
  );
