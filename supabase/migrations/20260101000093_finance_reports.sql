-- =========================================================================
-- PHASE 5: Finance & Accounting -- P&L, Balance Sheet, Cash Flow, AP/AR
-- aging. Cash Flow here is the direct-method total (beginning/inflows/
-- outflows/ending) rather than the full Operating/Investing/Financing
-- three-way split -- that split needs an activity-type classification on
-- bank_transactions this pass didn't add; documented as a follow-up in the
-- final report rather than left silently incomplete.
-- =========================================================================
create or replace function public.get_profit_and_loss(p_company_id uuid, p_start_date date, p_end_date date)
returns table (account_type text, account_code text, account_name text, amount numeric)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_superadmin() and not public.has_permission(p_company_id, 'FINANCE.REPORTS.VIEW') then
    raise exception 'Missing permission FINANCE.REPORTS.VIEW';
  end if;

  return query
  select
    coa.account_type, coa.code, coa.name,
    case when coa.account_type = 'REVENUE' then sum(jel.base_credit - jel.base_debit)
         else sum(jel.base_debit - jel.base_credit) end
  from public.journal_entry_lines jel
  join public.journal_entries je on je.id = jel.journal_entry_id
  join public.chart_of_accounts coa on coa.id = jel.account_id
  where je.company_id = p_company_id and je.status = 'POSTED'
    and je.date between p_start_date and p_end_date
    and coa.account_type in ('REVENUE', 'COGS', 'EXPENSE')
  group by coa.account_type, coa.code, coa.name
  order by coa.account_type, coa.code;
end;
$$;
grant execute on function public.get_profit_and_loss(uuid, date, date) to authenticated;

create or replace function public.get_balance_sheet(p_company_id uuid, p_as_of_date date)
returns table (account_type text, account_code text, account_name text, amount numeric)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_superadmin() and not public.has_permission(p_company_id, 'FINANCE.REPORTS.VIEW') then
    raise exception 'Missing permission FINANCE.REPORTS.VIEW';
  end if;

  return query
  select
    coa.account_type, coa.code, coa.name,
    case when coa.account_type = 'ASSET' then sum(jel.base_debit - jel.base_credit)
         else sum(jel.base_credit - jel.base_debit) end
  from public.journal_entry_lines jel
  join public.journal_entries je on je.id = jel.journal_entry_id
  join public.chart_of_accounts coa on coa.id = jel.account_id
  where je.company_id = p_company_id and je.status = 'POSTED' and je.date <= p_as_of_date
    and coa.account_type in ('ASSET', 'LIABILITY', 'EQUITY')
  group by coa.account_type, coa.code, coa.name
  order by coa.account_type, coa.code;
end;
$$;
grant execute on function public.get_balance_sheet(uuid, date) to authenticated;

create or replace function public.get_cash_flow(p_company_id uuid, p_start_date date, p_end_date date)
returns table (
  beginning_cash numeric, cash_inflows numeric, cash_outflows numeric,
  net_cash_flow numeric, ending_cash numeric
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_beginning numeric;
  v_inflows numeric;
  v_outflows numeric;
begin
  if not public.is_platform_superadmin() and not public.has_permission(p_company_id, 'FINANCE.REPORTS.VIEW') then
    raise exception 'Missing permission FINANCE.REPORTS.VIEW';
  end if;

  select coalesce(sum(ca.opening_balance), 0)
    + coalesce(sum((select sum(amount) from public.bank_transactions bt where bt.cash_account_id = ca.id and bt.direction = 'IN' and bt.transaction_date < p_start_date)), 0)
    - coalesce(sum((select sum(amount) from public.bank_transactions bt where bt.cash_account_id = ca.id and bt.direction = 'OUT' and bt.transaction_date < p_start_date)), 0)
  into v_beginning
  from public.cash_accounts ca where ca.company_id = p_company_id;

  select coalesce(sum(bt.amount), 0) into v_inflows
  from public.bank_transactions bt join public.cash_accounts ca on ca.id = bt.cash_account_id
  where ca.company_id = p_company_id and bt.direction = 'IN' and bt.transaction_date between p_start_date and p_end_date;

  select coalesce(sum(bt.amount), 0) into v_outflows
  from public.bank_transactions bt join public.cash_accounts ca on ca.id = bt.cash_account_id
  where ca.company_id = p_company_id and bt.direction = 'OUT' and bt.transaction_date between p_start_date and p_end_date;

  return query select v_beginning, v_inflows, v_outflows, v_inflows - v_outflows, v_beginning + v_inflows - v_outflows;
end;
$$;
grant execute on function public.get_cash_flow(uuid, date, date) to authenticated;

create or replace function public.get_ap_aging(p_company_id uuid)
returns table (
  supplier_id uuid, supplier_name text, bill_id uuid, bill_number text, due_date date,
  original_amount numeric, paid_amount numeric, outstanding numeric, days_overdue int, bucket text
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_superadmin() and not public.has_permission(p_company_id, 'FINANCE.AP.VIEW') then
    raise exception 'Missing permission FINANCE.AP.VIEW';
  end if;

  return query
  select
    s.id, s.name, sb.id, sb.bill_number, sb.due_date,
    sb.total, sb.paid_amount, sb.total - sb.paid_amount,
    greatest((current_date - sb.due_date)::int, 0),
    case
      when current_date <= sb.due_date then 'Current'
      when current_date - sb.due_date <= 30 then '1-30'
      when current_date - sb.due_date <= 60 then '31-60'
      when current_date - sb.due_date <= 90 then '61-90'
      else '90+'
    end
  from public.supplier_bills sb
  join public.suppliers s on s.id = sb.supplier_id
  where sb.company_id = p_company_id and sb.status in ('APPROVED', 'PARTIALLY_PAID', 'OVERDUE')
  order by sb.due_date;
end;
$$;
grant execute on function public.get_ap_aging(uuid) to authenticated;

create or replace function public.get_ar_aging(p_company_id uuid)
returns table (
  customer_id uuid, customer_name text, invoice_id uuid, invoice_number text, due_date date,
  original_amount numeric, paid_amount numeric, outstanding numeric, days_overdue int, bucket text
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_superadmin() and not public.has_permission(p_company_id, 'FINANCE.AR.VIEW') then
    raise exception 'Missing permission FINANCE.AR.VIEW';
  end if;

  return query
  select
    c.id, c.name, ci.id, ci.invoice_number, ci.due_date,
    ci.total, ci.paid_amount, ci.total - ci.paid_amount,
    greatest((current_date - ci.due_date)::int, 0),
    case
      when current_date <= ci.due_date then 'Current'
      when current_date - ci.due_date <= 30 then '1-30'
      when current_date - ci.due_date <= 60 then '31-60'
      when current_date - ci.due_date <= 90 then '61-90'
      else '90+'
    end
  from public.customer_invoices ci
  join public.customers c on c.id = ci.customer_id
  where ci.company_id = p_company_id and ci.status in ('SENT', 'PARTIALLY_PAID', 'OVERDUE')
  order by ci.due_date;
end;
$$;
grant execute on function public.get_ar_aging(uuid) to authenticated;
