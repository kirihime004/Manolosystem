-- =========================================================================
-- Wires up the six new Finance leaf keys, mirroring 000071 exactly:
-- backfill a row per existing company (copying FINANCE's current enabled
-- state, so nothing changes in what's visible today), extend
-- has_module_enabled()'s cascade, and move every Finance table's select/
-- insert policies off the now-parent-only 'FINANCE' key onto the specific
-- sub-key that owns that table. update/delete policies never checked the
-- module key to begin with (same as every other Phase 5 table) so they're
-- untouched.
--
-- Mapping (matches the Finance nav grouping in CompanyShell.tsx):
--   FINANCE_ACCOUNTING -- fiscal_years, financial_periods, chart_of_accounts,
--                         cost_centers, profit_centers, journal_entries,
--                         tax_rates (Settings' Tax Rates tab lives here)
--   FINANCE_AP          -- supplier_bills
--   FINANCE_AR          -- customers, customer_invoices
--   FINANCE_EXPENSES    -- expenses
--   FINANCE_BANK        -- cash_accounts
--   FINANCE_PAYROLL     -- payroll_runs
-- =========================================================================

-- ---------------------------------------------------------------------
-- Backfill: each of the six leaves copies FINANCE's current value.
-- ---------------------------------------------------------------------
insert into public.company_modules (company_id, module_key, enabled)
select cm.company_id, sub.key, cm.enabled
from public.company_modules cm
cross join (values
  ('FINANCE_ACCOUNTING'::public.module_key),
  ('FINANCE_AP'::public.module_key),
  ('FINANCE_AR'::public.module_key),
  ('FINANCE_EXPENSES'::public.module_key),
  ('FINANCE_BANK'::public.module_key),
  ('FINANCE_PAYROLL'::public.module_key)
) as sub(key)
where cm.module_key = 'FINANCE'
on conflict (company_id, module_key) do nothing;

-- ---------------------------------------------------------------------
-- has_module_enabled(): extend the existing cascade with the six new
-- Finance leaves. IT/HR cases are unchanged.
-- ---------------------------------------------------------------------
create or replace function public.has_module_enabled(p_company_id uuid, p_module_key public.module_key)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_parent_key public.module_key;
  v_own_enabled boolean;
  v_parent_enabled boolean;
begin
  if public.is_platform_superadmin() then
    return true;
  end if;

  v_parent_key := case p_module_key
    when 'TICKETING' then 'IT'
    when 'INVENTORY' then 'IT'
    when 'PROCUREMENT' then 'IT'
    when 'HR_EMPLOYEES' then 'HR'
    when 'HR_ATTENDANCE_LEAVE' then 'HR'
    when 'HR_PAYROLL' then 'HR'
    when 'FINANCE_ACCOUNTING' then 'FINANCE'
    when 'FINANCE_AP' then 'FINANCE'
    when 'FINANCE_AR' then 'FINANCE'
    when 'FINANCE_EXPENSES' then 'FINANCE'
    when 'FINANCE_BANK' then 'FINANCE'
    when 'FINANCE_PAYROLL' then 'FINANCE'
    else null
  end;

  select exists (
    select 1 from public.company_modules cm
    where cm.company_id = p_company_id and cm.module_key = p_module_key and cm.enabled = true
  ) into v_own_enabled;

  if v_parent_key is null then
    return v_own_enabled;
  end if;

  select exists (
    select 1 from public.company_modules cm
    where cm.company_id = p_company_id and cm.module_key = v_parent_key and cm.enabled = true
  ) into v_parent_enabled;

  return v_own_enabled and v_parent_enabled;
end;
$$;

grant execute on function public.has_module_enabled(uuid, public.module_key) to authenticated;

-- ---------------------------------------------------------------------
-- fiscal_years / financial_periods -> FINANCE_ACCOUNTING
-- ---------------------------------------------------------------------
drop policy "fiscal_years_select" on public.fiscal_years;
create policy "fiscal_years_select" on public.fiscal_years for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.PERIODS.VIEW'));
drop policy "fiscal_years_insert" on public.fiscal_years;
create policy "fiscal_years_insert" on public.fiscal_years for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.SETTINGS.MANAGE'));

drop policy "financial_periods_select" on public.financial_periods;
create policy "financial_periods_select" on public.financial_periods for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.PERIODS.VIEW'));
drop policy "financial_periods_insert" on public.financial_periods;
create policy "financial_periods_insert" on public.financial_periods for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.SETTINGS.MANAGE'));

-- ---------------------------------------------------------------------
-- chart_of_accounts -> FINANCE_ACCOUNTING
-- ---------------------------------------------------------------------
drop policy "chart_of_accounts_select" on public.chart_of_accounts;
create policy "chart_of_accounts_select" on public.chart_of_accounts for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.ACCOUNTS.VIEW'));
drop policy "chart_of_accounts_insert" on public.chart_of_accounts;
create policy "chart_of_accounts_insert" on public.chart_of_accounts for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.ACCOUNTS.CREATE'));

-- ---------------------------------------------------------------------
-- cost_centers / profit_centers -> FINANCE_ACCOUNTING
-- ---------------------------------------------------------------------
drop policy "cost_centers_select" on public.cost_centers;
create policy "cost_centers_select" on public.cost_centers for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and (public.has_permission(company_id, 'FINANCE.BUDGET.VIEW') or public.has_permission(company_id, 'FINANCE.COST_CENTERS.MANAGE')));
drop policy "cost_centers_insert" on public.cost_centers;
create policy "cost_centers_insert" on public.cost_centers for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.COST_CENTERS.MANAGE'));

drop policy "profit_centers_select" on public.profit_centers;
create policy "profit_centers_select" on public.profit_centers for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and (public.has_permission(company_id, 'FINANCE.BUDGET.VIEW') or public.has_permission(company_id, 'FINANCE.PROFIT_CENTERS.MANAGE')));
drop policy "profit_centers_insert" on public.profit_centers;
create policy "profit_centers_insert" on public.profit_centers for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.PROFIT_CENTERS.MANAGE'));

-- ---------------------------------------------------------------------
-- journal_entries -> FINANCE_ACCOUNTING
-- ---------------------------------------------------------------------
drop policy "journal_entries_select" on public.journal_entries;
create policy "journal_entries_select" on public.journal_entries for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.JOURNALS.VIEW'));
drop policy "journal_entries_insert" on public.journal_entries;
create policy "journal_entries_insert" on public.journal_entries for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.JOURNALS.CREATE'));

-- ---------------------------------------------------------------------
-- tax_rates -> FINANCE_ACCOUNTING (surfaced in Finance Settings)
-- ---------------------------------------------------------------------
drop policy "tax_rates_select" on public.tax_rates;
create policy "tax_rates_select" on public.tax_rates for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.TAX.VIEW'));
drop policy "tax_rates_insert" on public.tax_rates;
create policy "tax_rates_insert" on public.tax_rates for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_ACCOUNTING') and public.has_permission(company_id, 'FINANCE.TAX.MANAGE'));

-- ---------------------------------------------------------------------
-- supplier_bills -> FINANCE_AP
-- ---------------------------------------------------------------------
drop policy "supplier_bills_select" on public.supplier_bills;
create policy "supplier_bills_select" on public.supplier_bills for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_AP') and public.has_permission(company_id, 'FINANCE.AP.VIEW'));
drop policy "supplier_bills_insert" on public.supplier_bills;
create policy "supplier_bills_insert" on public.supplier_bills for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_AP') and public.has_permission(company_id, 'FINANCE.AP.CREATE'));

-- ---------------------------------------------------------------------
-- cash_accounts -> FINANCE_BANK
-- ---------------------------------------------------------------------
drop policy "cash_accounts_select" on public.cash_accounts;
create policy "cash_accounts_select" on public.cash_accounts for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_BANK') and public.has_permission(company_id, 'FINANCE.BANK.VIEW'));
drop policy "cash_accounts_insert" on public.cash_accounts;
create policy "cash_accounts_insert" on public.cash_accounts for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_BANK') and public.has_permission(company_id, 'FINANCE.BANK.CREATE'));

-- ---------------------------------------------------------------------
-- customers / customer_invoices -> FINANCE_AR
-- ---------------------------------------------------------------------
drop policy "customers_select" on public.customers;
create policy "customers_select" on public.customers for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_AR') and public.has_permission(company_id, 'FINANCE.CUSTOMERS.VIEW'));
drop policy "customers_insert" on public.customers;
create policy "customers_insert" on public.customers for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_AR') and public.has_permission(company_id, 'FINANCE.CUSTOMERS.MANAGE'));

drop policy "customer_invoices_select" on public.customer_invoices;
create policy "customer_invoices_select" on public.customer_invoices for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_AR') and public.has_permission(company_id, 'FINANCE.AR.VIEW'));
drop policy "customer_invoices_insert" on public.customer_invoices;
create policy "customer_invoices_insert" on public.customer_invoices for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_AR') and public.has_permission(company_id, 'FINANCE.AR.CREATE'));

-- ---------------------------------------------------------------------
-- expenses -> FINANCE_EXPENSES
-- ---------------------------------------------------------------------
drop policy "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_EXPENSES') and (public.has_permission(company_id, 'FINANCE.EXPENSES.VIEW') or public.is_own_employee(employee_id)));
drop policy "expenses_insert" on public.expenses;
create policy "expenses_insert" on public.expenses for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_EXPENSES') and (public.has_permission(company_id, 'FINANCE.EXPENSES.CREATE') or public.is_own_employee(employee_id)));

-- ---------------------------------------------------------------------
-- payroll_runs -> FINANCE_PAYROLL
-- ---------------------------------------------------------------------
drop policy "payroll_runs_select" on public.payroll_runs;
create policy "payroll_runs_select" on public.payroll_runs for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_PAYROLL') and public.has_permission(company_id, 'FINANCE.PAYROLL.VIEW'));
drop policy "payroll_runs_insert" on public.payroll_runs;
create policy "payroll_runs_insert" on public.payroll_runs for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE_PAYROLL') and public.has_permission(company_id, 'FINANCE.PAYROLL.PROCESS'));
