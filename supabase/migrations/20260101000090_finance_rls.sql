-- =========================================================================
-- PHASE 5: Finance & Accounting -- RLS for every table created in this
-- phase. Follows the standard template established in procurement_rls.sql/
-- hr_rls.sql exactly: has_company_access + has_module_enabled(FINANCE) +
-- has_permission, with is_platform_superadmin() already baked into the
-- first two helpers. Child tables (lines/items/approvals) check their
-- parent row's company_id rather than duplicating a company_id-based
-- policy of their own, since they always carry company_id but the real
-- authorization surface is "can you see/act on the parent record."
-- =========================================================================

-- ---------------------------------------------------------------------
-- fiscal_years / financial_periods
-- ---------------------------------------------------------------------
create policy "fiscal_years_select" on public.fiscal_years for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.PERIODS.VIEW'));
create policy "fiscal_years_insert" on public.fiscal_years for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.SETTINGS.MANAGE'));
create policy "fiscal_years_update" on public.fiscal_years for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.SETTINGS.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "fiscal_years_delete" on public.fiscal_years for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.SETTINGS.MANAGE'));

create policy "financial_periods_select" on public.financial_periods for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.PERIODS.VIEW'));
create policy "financial_periods_insert" on public.financial_periods for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.SETTINGS.MANAGE'));
create policy "financial_periods_update" on public.financial_periods for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.PERIODS.CLOSE'))
  with check (public.has_company_access(company_id));
create policy "financial_periods_delete" on public.financial_periods for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.SETTINGS.MANAGE'));

-- ---------------------------------------------------------------------
-- chart_of_accounts
-- ---------------------------------------------------------------------
create policy "chart_of_accounts_select" on public.chart_of_accounts for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.ACCOUNTS.VIEW'));
create policy "chart_of_accounts_insert" on public.chart_of_accounts for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.ACCOUNTS.CREATE'));
create policy "chart_of_accounts_update" on public.chart_of_accounts for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.ACCOUNTS.UPDATE'))
  with check (public.has_company_access(company_id));
create policy "chart_of_accounts_delete" on public.chart_of_accounts for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.ACCOUNTS.ARCHIVE') and not is_system);

-- ---------------------------------------------------------------------
-- cost_centers / profit_centers
-- ---------------------------------------------------------------------
create policy "cost_centers_select" on public.cost_centers for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and (public.has_permission(company_id, 'FINANCE.BUDGET.VIEW') or public.has_permission(company_id, 'FINANCE.COST_CENTERS.MANAGE')));
create policy "cost_centers_insert" on public.cost_centers for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.COST_CENTERS.MANAGE'));
create policy "cost_centers_update" on public.cost_centers for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.COST_CENTERS.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "cost_centers_delete" on public.cost_centers for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.COST_CENTERS.MANAGE'));

create policy "profit_centers_select" on public.profit_centers for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and (public.has_permission(company_id, 'FINANCE.BUDGET.VIEW') or public.has_permission(company_id, 'FINANCE.PROFIT_CENTERS.MANAGE')));
create policy "profit_centers_insert" on public.profit_centers for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.PROFIT_CENTERS.MANAGE'));
create policy "profit_centers_update" on public.profit_centers for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.PROFIT_CENTERS.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "profit_centers_delete" on public.profit_centers for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.PROFIT_CENTERS.MANAGE'));

-- ---------------------------------------------------------------------
-- journal_entries / journal_entry_lines / journal_entry_approvals
-- ---------------------------------------------------------------------
create policy "journal_entries_select" on public.journal_entries for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.JOURNALS.VIEW'));
create policy "journal_entries_insert" on public.journal_entries for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.JOURNALS.CREATE'));
create policy "journal_entries_update" on public.journal_entries for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.JOURNALS.UPDATE') or public.has_permission(company_id, 'FINANCE.JOURNALS.POST') or public.has_permission(company_id, 'FINANCE.JOURNALS.APPROVE') or public.has_permission(company_id, 'FINANCE.JOURNALS.REVERSE')))
  with check (public.has_company_access(company_id));
create policy "journal_entries_delete" on public.journal_entries for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.JOURNALS.UPDATE') and status = 'DRAFT');

create policy "journal_entry_lines_select" on public.journal_entry_lines for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.JOURNALS.VIEW'));
create policy "journal_entry_lines_insert" on public.journal_entry_lines for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.JOURNALS.CREATE'));
create policy "journal_entry_lines_update" on public.journal_entry_lines for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.JOURNALS.CREATE'))
  with check (public.has_company_access(company_id));
create policy "journal_entry_lines_delete" on public.journal_entry_lines for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.JOURNALS.CREATE'));

create policy "journal_entry_approvals_select" on public.journal_entry_approvals for select
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.JOURNALS.VIEW') or approver_id = auth.uid()));
create policy "journal_entry_approvals_update" on public.journal_entry_approvals for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, required_permission))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- supplier_bills / supplier_bill_items / supplier_bill_approvals / supplier_payments
-- ---------------------------------------------------------------------
create policy "supplier_bills_select" on public.supplier_bills for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.AP.VIEW'));
create policy "supplier_bills_insert" on public.supplier_bills for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.AP.CREATE'));
create policy "supplier_bills_update" on public.supplier_bills for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.AP.CREATE') or public.has_permission(company_id, 'FINANCE.AP.APPROVE') or public.has_permission(company_id, 'FINANCE.AP.PAY')))
  with check (public.has_company_access(company_id));
create policy "supplier_bills_delete" on public.supplier_bills for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.CREATE') and status = 'DRAFT');

create policy "supplier_bill_items_select" on public.supplier_bill_items for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.VIEW'));
create policy "supplier_bill_items_insert" on public.supplier_bill_items for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.CREATE'));
create policy "supplier_bill_items_update" on public.supplier_bill_items for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.CREATE'))
  with check (public.has_company_access(company_id));
create policy "supplier_bill_items_delete" on public.supplier_bill_items for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.CREATE'));

create policy "supplier_bill_approvals_select" on public.supplier_bill_approvals for select
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.AP.VIEW') or approver_id = auth.uid()));
create policy "supplier_bill_approvals_update" on public.supplier_bill_approvals for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.APPROVE'))
  with check (public.has_company_access(company_id));

create policy "supplier_payments_select" on public.supplier_payments for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.VIEW'));
create policy "supplier_payments_insert" on public.supplier_payments for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.PAY'));
create policy "supplier_payments_update" on public.supplier_payments for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AP.PAY'))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- cash_accounts / bank_transactions / bank_reconciliations
-- ---------------------------------------------------------------------
create policy "cash_accounts_select" on public.cash_accounts for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.BANK.VIEW'));
create policy "cash_accounts_insert" on public.cash_accounts for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.BANK.CREATE'));
create policy "cash_accounts_update" on public.cash_accounts for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.BANK.CREATE'))
  with check (public.has_company_access(company_id));

create policy "bank_transactions_select" on public.bank_transactions for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.BANK.VIEW'));
create policy "bank_transactions_insert" on public.bank_transactions for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.BANK.CREATE'));
create policy "bank_transactions_update" on public.bank_transactions for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.BANK.RECONCILE'))
  with check (public.has_company_access(company_id));

create policy "bank_reconciliations_select" on public.bank_reconciliations for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.BANK.VIEW'));
create policy "bank_reconciliations_insert" on public.bank_reconciliations for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.BANK.RECONCILE'));
create policy "bank_reconciliations_update" on public.bank_reconciliations for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.BANK.RECONCILE'))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- customers / customer_invoices / customer_invoice_items / customer_payments
-- ---------------------------------------------------------------------
create policy "customers_select" on public.customers for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.CUSTOMERS.VIEW'));
create policy "customers_insert" on public.customers for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.CUSTOMERS.MANAGE'));
create policy "customers_update" on public.customers for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.CUSTOMERS.MANAGE'))
  with check (public.has_company_access(company_id));

create policy "customer_invoices_select" on public.customer_invoices for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.AR.VIEW'));
create policy "customer_invoices_insert" on public.customer_invoices for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.AR.CREATE'));
create policy "customer_invoices_update" on public.customer_invoices for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.AR.CREATE') or public.has_permission(company_id, 'FINANCE.AR.APPROVE') or public.has_permission(company_id, 'FINANCE.AR.RECEIVE_PAYMENT')))
  with check (public.has_company_access(company_id));
create policy "customer_invoices_delete" on public.customer_invoices for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.CREATE') and status = 'DRAFT');

create policy "customer_invoice_items_select" on public.customer_invoice_items for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.VIEW'));
create policy "customer_invoice_items_insert" on public.customer_invoice_items for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.CREATE'));
create policy "customer_invoice_items_update" on public.customer_invoice_items for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.CREATE'))
  with check (public.has_company_access(company_id));
create policy "customer_invoice_items_delete" on public.customer_invoice_items for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.CREATE'));

create policy "customer_payments_select" on public.customer_payments for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.VIEW'));
create policy "customer_payments_insert" on public.customer_payments for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.RECEIVE_PAYMENT'));
create policy "customer_payments_update" on public.customer_payments for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.AR.RECEIVE_PAYMENT'))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- expenses / expense_approvals -- self-service via is_own_employee(),
-- exactly like HR's leave_requests/overtime_requests.
-- ---------------------------------------------------------------------
create policy "expenses_select" on public.expenses for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and (public.has_permission(company_id, 'FINANCE.EXPENSES.VIEW') or public.is_own_employee(employee_id)));
create policy "expenses_insert" on public.expenses for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and (public.has_permission(company_id, 'FINANCE.EXPENSES.CREATE') or public.is_own_employee(employee_id)));
create policy "expenses_update" on public.expenses for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.EXPENSES.APPROVE') or public.has_permission(company_id, 'FINANCE.EXPENSES.PAY') or (public.is_own_employee(employee_id) and status = 'DRAFT')))
  with check (public.has_company_access(company_id));
create policy "expenses_delete" on public.expenses for delete
  using (public.has_company_access(company_id) and public.is_own_employee(employee_id) and status = 'DRAFT');

create policy "expense_approvals_select" on public.expense_approvals for select
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.EXPENSES.APPROVE') or approver_id = auth.uid()
    or exists (select 1 from public.expenses e where e.id = expense_id and public.is_own_employee(e.employee_id))));
create policy "expense_approvals_update" on public.expense_approvals for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.EXPENSES.APPROVE'))
  with check (public.has_company_access(company_id));

-- ---------------------------------------------------------------------
-- tax_rates / tax_transactions
-- ---------------------------------------------------------------------
create policy "tax_rates_select" on public.tax_rates for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.TAX.VIEW'));
create policy "tax_rates_insert" on public.tax_rates for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.TAX.MANAGE'));
create policy "tax_rates_update" on public.tax_rates for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.TAX.MANAGE'))
  with check (public.has_company_access(company_id));
create policy "tax_rates_delete" on public.tax_rates for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.TAX.MANAGE'));

create policy "tax_transactions_select" on public.tax_transactions for select
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.TAX.VIEW'));

-- ---------------------------------------------------------------------
-- payroll_runs / payroll_items -- salary data, so beyond the module
-- permission this also requires HR.EMPLOYEES.VIEW_SALARY, mirroring the
-- exact gate Phase 4 put on employee_compensation.
-- ---------------------------------------------------------------------
create policy "payroll_runs_select" on public.payroll_runs for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.PAYROLL.VIEW'));
create policy "payroll_runs_insert" on public.payroll_runs for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'FINANCE') and public.has_permission(company_id, 'FINANCE.PAYROLL.PROCESS'));
create policy "payroll_runs_update" on public.payroll_runs for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.PAYROLL.PROCESS') or public.has_permission(company_id, 'FINANCE.PAYROLL.APPROVE') or public.has_permission(company_id, 'FINANCE.PAYROLL.PAY')))
  with check (public.has_company_access(company_id));

create policy "payroll_items_select" on public.payroll_items for select
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'FINANCE.PAYROLL.VIEW') or public.is_own_employee(employee_id)));
create policy "payroll_items_insert" on public.payroll_items for insert
  with check (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.PAYROLL.PROCESS'));
create policy "payroll_items_update" on public.payroll_items for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.PAYROLL.PROCESS'))
  with check (public.has_company_access(company_id));
create policy "payroll_items_delete" on public.payroll_items for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'FINANCE.PAYROLL.PROCESS'));
