-- =========================================================================
-- PHASE 5: Finance & Accounting -- reuses the existing notifications table,
-- widening the type CHECK again (same pattern every phase has used).
-- =========================================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'HARDWARE_NEARING_EOL', 'HARDWARE_OVER_EOL', 'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED',
  'SUBSCRIPTION_RENEWAL_DUE', 'SUBSCRIPTION_EXPIRED', 'IP_CONFLICT', 'ASSET_DEFECTIVE', 'REPAIR_OVERDUE',
  'PR_SUBMITTED', 'PR_APPROVED', 'PR_REJECTED',
  'PO_AWAITING_APPROVAL', 'PO_APPROVED', 'PO_SENT_TO_SUPPLIER',
  'DELIVERY_OVERDUE', 'DELIVERY_PARTIAL',
  'BUDGET_THRESHOLD', 'BUDGET_PERIOD_ENDING',
  'NEW_EMPLOYEE', 'ONBOARDING_TASK', 'OFFBOARDING_TASK', 'PROBATION_ENDING',
  'CONTRACT_EXPIRING', 'DOCUMENT_EXPIRING',
  'LEAVE_SUBMITTED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
  'ATTENDANCE_CORRECTION_SUBMITTED', 'ATTENDANCE_CORRECTION_APPROVED', 'ATTENDANCE_CORRECTION_REJECTED',
  'OVERTIME_SUBMITTED', 'OVERTIME_APPROVED', 'OVERTIME_REJECTED',
  'PAYROLL_PENDING', 'EMPLOYEE_TERMINATED',
  'HR_REQUEST_SUBMITTED', 'HR_REQUEST_UNDER_REVIEW', 'HR_REQUEST_APPROVED',
  'HR_REQUEST_REJECTED', 'HR_REQUEST_COMPLETED', 'HR_REQUEST_CANCELLED',
  'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'EXPENSE_REJECTED', 'PAYMENT_COMPLETED',
  'PAYROLL_APPROVED', 'PAYROLL_PAID',
  'INVOICE_DUE', 'INVOICE_OVERDUE', 'BILL_DUE', 'BILL_OVERDUE',
  'TAX_DEADLINE', 'FINANCIAL_PERIOD_CLOSING', 'BANK_RECONCILIATION_REQUIRED'
));

-- ---------------------------------------------------------------------
-- Periodic sweep, same shape as generate_procurement_notifications()/
-- generate_hr_notifications(): scans for time-based conditions and inserts
-- with the dedupe-safe ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------
create or replace function public.generate_finance_notifications(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  if not public.has_permission(p_company_id, 'FINANCE.DASHBOARD.VIEW') then
    raise exception 'Missing permission FINANCE.DASHBOARD.VIEW';
  end if;

  for v_row in
    select id, invoice_number from public.customer_invoices
    where company_id = p_company_id and status in ('SENT', 'PARTIALLY_PAID') and due_date < current_date
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'INVOICE_OVERDUE', 'Invoice overdue', v_row.invoice_number || ' is overdue.', 'customer_invoice', v_row.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
    perform set_config('app.invoice_status_transition', 'OVERDUE', true);
    update public.customer_invoices set status = 'OVERDUE' where id = v_row.id and status in ('SENT', 'PARTIALLY_PAID');
  end loop;

  for v_row in
    select id, invoice_number from public.customer_invoices
    where company_id = p_company_id and status in ('SENT', 'PARTIALLY_PAID') and due_date between current_date and current_date + 3
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'INVOICE_DUE', 'Invoice due soon', v_row.invoice_number || ' is due within 3 days.', 'customer_invoice', v_row.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  for v_row in
    select id, bill_number from public.supplier_bills
    where company_id = p_company_id and status in ('APPROVED', 'PARTIALLY_PAID') and due_date < current_date
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'BILL_OVERDUE', 'Bill overdue', v_row.bill_number || ' is overdue.', 'supplier_bill', v_row.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
    perform set_config('app.bill_status_transition', 'OVERDUE', true);
    update public.supplier_bills set status = 'OVERDUE' where id = v_row.id and status in ('APPROVED', 'PARTIALLY_PAID');
  end loop;

  for v_row in
    select id, bill_number from public.supplier_bills
    where company_id = p_company_id and status in ('APPROVED', 'PARTIALLY_PAID') and due_date between current_date and current_date + 3
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'BILL_DUE', 'Bill due soon', v_row.bill_number || ' is due within 3 days.', 'supplier_bill', v_row.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  for v_row in
    select id, name from public.financial_periods
    where company_id = p_company_id and status = 'OPEN' and end_date between current_date and current_date + 5
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'FINANCIAL_PERIOD_CLOSING', 'Financial period closing soon', v_row.name || ' closes within 5 days.', 'financial_period', v_row.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  for v_row in
    select ca.id, ca.name from public.cash_accounts ca
    where ca.company_id = p_company_id and ca.status = 'ACTIVE'
      and exists (
        select 1 from public.bank_transactions bt
        where bt.cash_account_id = ca.id and not bt.reconciled and bt.transaction_date < current_date - 30
      )
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'BANK_RECONCILIATION_REQUIRED', 'Bank reconciliation needed',
      v_row.name || ' has unreconciled transactions older than 30 days.', 'cash_account', v_row.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;
grant execute on function public.generate_finance_notifications(uuid) to authenticated;
