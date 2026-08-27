-- =========================================================================
-- Adds a dedicated "Gain/Loss on Disposal of Assets" account so asset
-- write-offs get their own clean line in Finance reports instead of being
-- dumped into the generic 6900 "Other Expenses" catch-all (which is
-- already used as the fallback for uncategorized bill items -- comingling
-- the two would make disposal losses invisible in reporting).
-- =========================================================================
create or replace function public.seed_chart_of_accounts(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assets uuid; v_liabilities uuid; v_equity uuid; v_revenue uuid; v_cogs uuid; v_expenses uuid;
begin
  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '1000', 'Assets', 'ASSET', true, true) returning id into v_assets;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '1100', 'Cash', 'ASSET', v_assets, true),
    (p_company_id, '1110', 'Bank', 'ASSET', v_assets, true),
    (p_company_id, '1120', 'Petty Cash', 'ASSET', v_assets, true),
    (p_company_id, '1200', 'Accounts Receivable', 'ASSET', v_assets, true),
    (p_company_id, '1300', 'Inventory', 'ASSET', v_assets, true),
    (p_company_id, '1400', 'Prepaid Expenses', 'ASSET', v_assets, true),
    (p_company_id, '1500', 'Fixed Assets', 'ASSET', v_assets, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '2000', 'Liabilities', 'LIABILITY', true, true) returning id into v_liabilities;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '2100', 'Accounts Payable', 'LIABILITY', v_liabilities, true),
    (p_company_id, '2200', 'Taxes Payable', 'LIABILITY', v_liabilities, true),
    (p_company_id, '2300', 'Payroll Liabilities', 'LIABILITY', v_liabilities, true),
    (p_company_id, '2400', 'Loans', 'LIABILITY', v_liabilities, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '3000', 'Equity', 'EQUITY', true, true) returning id into v_equity;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '3100', 'Owner Equity', 'EQUITY', v_equity, true),
    (p_company_id, '3200', 'Retained Earnings', 'EQUITY', v_equity, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '4000', 'Revenue', 'REVENUE', true, true) returning id into v_revenue;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '4100', 'Animation Revenue', 'REVENUE', v_revenue, true),
    (p_company_id, '4200', 'Service Revenue', 'REVENUE', v_revenue, true),
    (p_company_id, '4300', 'Other Revenue', 'REVENUE', v_revenue, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '5000', 'Cost of Goods Sold', 'COGS', true, true) returning id into v_cogs;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '5100', 'Production Costs', 'COGS', v_cogs, true),
    (p_company_id, '5200', 'Direct Costs', 'COGS', v_cogs, true);

  insert into public.chart_of_accounts (company_id, code, name, account_type, is_header, is_system)
    values (p_company_id, '6000', 'Expenses', 'EXPENSE', true, true) returning id into v_expenses;
  insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system) values
    (p_company_id, '6100', 'Salaries', 'EXPENSE', v_expenses, true),
    (p_company_id, '6200', 'Rent', 'EXPENSE', v_expenses, true),
    (p_company_id, '6300', 'Utilities', 'EXPENSE', v_expenses, true),
    (p_company_id, '6400', 'Software', 'EXPENSE', v_expenses, true),
    (p_company_id, '6500', 'IT Expenses', 'EXPENSE', v_expenses, true),
    (p_company_id, '6600', 'Travel', 'EXPENSE', v_expenses, true),
    (p_company_id, '6700', 'Office Expenses', 'EXPENSE', v_expenses, true),
    (p_company_id, '6800', 'Marketing', 'EXPENSE', v_expenses, true),
    (p_company_id, '6900', 'Other Expenses', 'EXPENSE', v_expenses, true),
    (p_company_id, '6910', 'Gain/Loss on Disposal of Assets', 'EXPENSE', v_expenses, true);
end;
$$;

-- Backfill: existing companies already ran the old seed and won't get the
-- new account just by redefining the function above.
insert into public.chart_of_accounts (company_id, code, name, account_type, parent_account_id, is_system)
select c.id, '6910', 'Gain/Loss on Disposal of Assets', 'EXPENSE', p.id, true
from public.companies c
join public.chart_of_accounts p on p.company_id = c.id and p.code = '6000'
where not exists (
  select 1 from public.chart_of_accounts existing where existing.company_id = c.id and existing.code = '6910'
);
