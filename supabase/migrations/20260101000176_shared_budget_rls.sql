-- =========================================================================
-- BUDGET & PROCUREMENT ARCHITECTURE CORRECTION -- Part 6: RLS.
--
-- Schema refinement first: `departments` is a free-text, company-
-- configurable org-chart table (any company can name a department
-- anything), but this app's entire RBAC system gates access through the
-- fixed 5-value `module_key` enum (IT/HR/FINANCE/ADMIN/PRODUCTION) via
-- has_permission()/has_module_enabled(). Those are two different
-- dimensions -- a budget's `department_id` (which real-world team owns
-- it, for reporting) is not reliably the same thing as which permission
-- namespace should gate who can see it. Adding a `module_key` column
-- resolves this cleanly: RLS gates on `module_key` (matches
-- '<MODULE>.BUDGET.VIEW' exactly), while `department_id` stays a free,
-- optional org-chart tag.
-- =========================================================================

alter table public.budgets add column module_key public.module_key;
alter table public.budget_lines add column module_key public.module_key;

-- Backfill: every budget already has department_id = the company's "IT"
-- department from the prior migration's backfill, so module_key = 'IT'
-- is correct for all of them. Going forward the app sets module_key
-- explicitly at creation time (the department picker maps 1:1 to one of
-- the five fixed modules).
update public.budgets set module_key = 'IT' where module_key is null;
alter table public.budgets alter column module_key set not null;

create index budgets_module_idx on public.budgets (company_id, module_key);

-- ---------------------------------------------------------------------
-- can_view_budget(): mirrors can_view_purchase_request()'s shape.
-- Visible if the caller holds that module's own <MODULE>.BUDGET.VIEW
-- permission, OR holds BUDGET.FINANCE_APPROVE/BUDGET.ADMIN_OVERRIDE
-- (Finance and an explicit, audited override can see every department's
-- budgets), always still gated on has_company_access.
-- ---------------------------------------------------------------------
create or replace function public.can_view_budget(p_company_id uuid, p_module_key public.module_key)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.has_company_access(p_company_id)
    and (
      public.has_permission(p_company_id, p_module_key::text || '.BUDGET.VIEW')
      or public.has_permission(p_company_id, 'BUDGET.FINANCE_APPROVE')
      or public.has_permission(p_company_id, 'BUDGET.ADMIN_OVERRIDE')
    );
$$;

create or replace function public.can_edit_budget(p_company_id uuid, p_module_key public.module_key, p_action text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.has_company_access(p_company_id)
    and public.has_permission(p_company_id, p_module_key::text || '.BUDGET.' || p_action);
$$;

grant execute on function public.can_view_budget(uuid, public.module_key) to authenticated;
grant execute on function public.can_edit_budget(uuid, public.module_key, text) to authenticated;

-- ---------------------------------------------------------------------
-- budgets: replace the IT-only-namespaced policies with the shared,
-- module-scoped ones. Insert requires the caller to be creating it for a
-- module they actually hold *.BUDGET.CREATE for.
-- ---------------------------------------------------------------------
drop policy "budgets_select" on public.budgets;
create policy "budgets_select" on public.budgets
  for select using (public.can_view_budget(company_id, module_key));

drop policy "budgets_insert" on public.budgets;
create policy "budgets_insert" on public.budgets
  for insert with check (public.can_edit_budget(company_id, module_key, 'CREATE'));

drop policy "budgets_update" on public.budgets;
create policy "budgets_update" on public.budgets
  for update using (
    public.can_edit_budget(company_id, module_key, 'UPDATE')
    or public.has_permission(company_id, 'BUDGET.FINANCE_APPROVE')
    or public.has_permission(company_id, 'IT.BUDGET.CLOSE')
  );

drop policy "budgets_delete" on public.budgets;
create policy "budgets_delete" on public.budgets
  for delete using (public.can_edit_budget(company_id, module_key, 'DELETE'));

-- ---------------------------------------------------------------------
-- budget_lines: readable alongside the parent budget; writable only
-- while the parent is in an editable state (enforced by the
-- lock_budget_lines trigger already, this is the visibility half).
-- ---------------------------------------------------------------------
create policy "budget_lines_select" on public.budget_lines
  for select using (public.can_view_budget(company_id, module_key));
create policy "budget_lines_insert" on public.budget_lines
  for insert with check (public.can_edit_budget(company_id, module_key, 'UPDATE') or public.can_edit_budget(company_id, module_key, 'CREATE'));
create policy "budget_lines_update" on public.budget_lines
  for update using (public.can_edit_budget(company_id, module_key, 'UPDATE') or public.has_permission(company_id, 'BUDGET.FINANCE_APPROVE'));
create policy "budget_lines_delete" on public.budget_lines
  for delete using (public.can_edit_budget(company_id, module_key, 'UPDATE'));

-- ---------------------------------------------------------------------
-- budget_history / budget_revisions: read-only for clients, same
-- visibility as the parent budget; revisions insert only via
-- request_budget_increase()/decide_budget_revision() (security definer).
-- ---------------------------------------------------------------------
create policy "budget_history_select" on public.budget_history
  for select using (
    exists (select 1 from public.budgets b where b.id = budget_id and public.can_view_budget(b.company_id, b.module_key))
  );

create policy "budget_revisions_select" on public.budget_revisions
  for select using (
    exists (select 1 from public.budgets b where b.id = budget_id and public.can_view_budget(b.company_id, b.module_key))
  );

-- ---------------------------------------------------------------------
-- budget_categories / budget_allocations / budget_transactions /
-- budget_alert_thresholds still key off IT.BUDGET.* + the PROCUREMENT
-- module today (categories and alert thresholds are still a single
-- company-wide catalog, not per-department -- unchanged from Phase 3).
-- Widen visibility so any department holding its own *.BUDGET.VIEW (not
-- just IT) can read the shared category catalog and see allocations/
-- transactions tied to ITS OWN budgets, and so Finance can see all of
-- them via BUDGET.FINANCE_APPROVE.
-- ---------------------------------------------------------------------
drop policy "budget_categories_select" on public.budget_categories;
create policy "budget_categories_select" on public.budget_categories
  for select using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'IT.BUDGET.VIEW') or public.has_permission(company_id, 'HR.BUDGET.VIEW')
      or public.has_permission(company_id, 'FINANCE.BUDGET.VIEW') or public.has_permission(company_id, 'ADMIN.BUDGET.VIEW')
      or public.has_permission(company_id, 'PRODUCTION.BUDGET.VIEW') or public.has_permission(company_id, 'BUDGET.FINANCE_APPROVE')
    )
  );

drop policy "budget_allocations_select" on public.budget_allocations;
create policy "budget_allocations_select" on public.budget_allocations
  for select using (
    exists (select 1 from public.budgets b where b.id = budget_id and public.can_view_budget(b.company_id, b.module_key))
  );

drop policy "budget_transactions_select" on public.budget_transactions;
create policy "budget_transactions_select" on public.budget_transactions
  for select using (
    exists (select 1 from public.budgets b where b.id = budget_id and public.can_view_budget(b.company_id, b.module_key))
  );

drop policy "budget_alert_thresholds_select" on public.budget_alert_thresholds;
create policy "budget_alert_thresholds_select" on public.budget_alert_thresholds
  for select using (
    public.has_company_access(company_id)
    and (public.has_permission(company_id, 'IT.BUDGET.VIEW') or public.has_permission(company_id, 'BUDGET.FINANCE_APPROVE'))
  );
