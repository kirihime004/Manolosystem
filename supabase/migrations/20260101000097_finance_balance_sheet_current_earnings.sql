-- =========================================================================
-- Fix: get_balance_sheet() only summed ASSET/LIABILITY/EQUITY accounts,
-- completely excluding REVENUE/COGS/EXPENSE. Real accounting software
-- balances a live "as of today" balance sheet by folding the current
-- fiscal year's net income (Revenue - COGS - Expenses to date) into
-- Equity as "Current Year Earnings" -- formal period-close entries only
-- become necessary once the year is over. Without that fold, the sheet
-- would show a FINANCIAL INTEGRITY ERROR for every company, every day,
-- which is the false-alarm case spec section 17 explicitly does not want
-- ("do not hide discrepancies" implies real discrepancies are the
-- exception, not the permanent default). Caught by live-testing: after
-- posting real expense/revenue-adjacent journals, Assets != Liabilities +
-- Equity even though nothing was actually wrong.
-- =========================================================================
create or replace function public.get_balance_sheet(p_company_id uuid, p_as_of_date date)
returns table (account_type text, account_code text, account_name text, amount numeric)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_fy_start date;
  v_current_earnings numeric;
begin
  if not public.is_platform_superadmin() and not public.has_permission(p_company_id, 'FINANCE.REPORTS.VIEW') then
    raise exception 'Missing permission FINANCE.REPORTS.VIEW';
  end if;

  select start_date into v_fy_start from public.fiscal_years
  where company_id = p_company_id and start_date <= p_as_of_date and end_date >= p_as_of_date
  order by start_date desc limit 1;

  return query
  select
    coa.account_type, coa.code, coa.name,
    case when coa.account_type = 'ASSET' then sum(jel.base_debit - jel.base_credit)
         else sum(jel.base_credit - jel.base_debit) end
  from public.journal_entry_lines jel
  join public.journal_entries je on je.id = jel.journal_entry_id
  join public.chart_of_accounts coa on coa.id = jel.account_id
  where je.company_id = p_company_id and je.status in ('POSTED', 'REVERSED') and je.date <= p_as_of_date
    and coa.account_type in ('ASSET', 'LIABILITY', 'EQUITY')
  group by coa.account_type, coa.code, coa.name;

  -- Fold the current fiscal year's net income into Equity so the sheet
  -- balances at any point in time, exactly like every other real
  -- accounting system does before formal period-close entries exist.
  if v_fy_start is not null then
    -- Revenue is credit-normal (credit-debit is already "+contributes to
    -- earnings"); COGS/Expense are debit-normal, and credit-debit for them
    -- is the negative of their expense balance -- exactly "-contributes to
    -- earnings". Both fall out of the same sum(credit - debit), no
    -- per-type sign-flipping needed.
    select coalesce(sum(jel.base_credit - jel.base_debit), 0)
    into v_current_earnings
    from public.journal_entry_lines jel
    join public.journal_entries je on je.id = jel.journal_entry_id
    join public.chart_of_accounts coa on coa.id = jel.account_id
    where je.company_id = p_company_id and je.status in ('POSTED', 'REVERSED')
      and je.date between v_fy_start and p_as_of_date
      and coa.account_type in ('REVENUE', 'COGS', 'EXPENSE');

    if v_current_earnings <> 0 then
      return query select 'EQUITY'::text, '3900'::text, 'Current Year Earnings'::text, v_current_earnings;
    end if;
  end if;
end;
$$;
