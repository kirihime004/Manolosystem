-- =========================================================================
-- PHASE 5: Finance & Accounting -- General Ledger and Trial Balance.
-- v_general_ledger is a plain filterable/paginatable view (same shape as
-- Phase 3's v_budget_summary) so the frontend can query/filter/paginate it
-- directly via PostgREST rather than a bespoke RPC. get_trial_balance() is
-- a function because it needs a period parameter to split opening/period/
-- closing balances. Both run with the caller's own RLS (no SECURITY
-- DEFINER) so access control lives in one place: the RLS policies on
-- journal_entries/journal_entry_lines/chart_of_accounts.
-- =========================================================================
create or replace view public.v_general_ledger
with (security_invoker = true) as
select
  jel.id as line_id,
  je.company_id,
  je.id as journal_entry_id,
  je.journal_number,
  je.date,
  je.reference_type,
  je.reference_id,
  jel.account_id,
  coa.code as account_code,
  coa.name as account_name,
  coa.account_type,
  jel.description,
  jel.base_debit as debit,
  jel.base_credit as credit,
  sum(
    case when coa.account_type in ('ASSET', 'EXPENSE', 'COGS') then jel.base_debit - jel.base_credit
         else jel.base_credit - jel.base_debit end
  ) over (partition by jel.account_id order by je.date, je.journal_number, jel.line_number, jel.id) as balance,
  jel.department_id, jel.employee_id, jel.supplier_id, jel.customer_id, jel.project_id,
  jel.cost_center_id, jel.profit_center_id,
  je.currency_id, je.base_currency_id, je.status
from public.journal_entry_lines jel
join public.journal_entries je on je.id = jel.journal_entry_id
join public.chart_of_accounts coa on coa.id = jel.account_id
where je.status = 'POSTED'
  and (public.is_platform_superadmin() or public.has_permission(je.company_id, 'FINANCE.GL.VIEW'));

grant select on public.v_general_ledger to authenticated;

create or replace function public.get_trial_balance(p_company_id uuid, p_financial_period_id uuid)
returns table (
  account_id uuid, account_code text, account_name text, account_type text,
  opening_debit numeric, opening_credit numeric,
  period_debit numeric, period_credit numeric,
  closing_debit numeric, closing_credit numeric
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_superadmin() and not public.has_permission(p_company_id, 'FINANCE.TRIAL_BALANCE.VIEW') then
    raise exception 'Missing permission FINANCE.TRIAL_BALANCE.VIEW';
  end if;

  return query
  with period as (
    select start_date, end_date from public.financial_periods
    where id = p_financial_period_id and company_id = p_company_id
  ),
  opening as (
    select jel.account_id, sum(jel.base_debit) as d, sum(jel.base_credit) as c
    from public.journal_entry_lines jel
    join public.journal_entries je on je.id = jel.journal_entry_id
    cross join period p
    where je.company_id = p_company_id and je.status = 'POSTED' and je.date < p.start_date
    group by jel.account_id
  ),
  activity as (
    select jel.account_id, sum(jel.base_debit) as d, sum(jel.base_credit) as c
    from public.journal_entry_lines jel
    join public.journal_entries je on je.id = jel.journal_entry_id
    cross join period p
    where je.company_id = p_company_id and je.status = 'POSTED' and je.date between p.start_date and p.end_date
    group by jel.account_id
  )
  select
    coa.id, coa.code, coa.name, coa.account_type,
    greatest(coalesce(o.d, 0) - coalesce(o.c, 0), 0), greatest(coalesce(o.c, 0) - coalesce(o.d, 0), 0),
    greatest(coalesce(a.d, 0), 0), greatest(coalesce(a.c, 0), 0),
    greatest((coalesce(o.d, 0) + coalesce(a.d, 0)) - (coalesce(o.c, 0) + coalesce(a.c, 0)), 0),
    greatest((coalesce(o.c, 0) + coalesce(a.c, 0)) - (coalesce(o.d, 0) + coalesce(a.d, 0)), 0)
  from public.chart_of_accounts coa
  left join opening o on o.account_id = coa.id
  left join activity a on a.account_id = coa.id
  where coa.company_id = p_company_id and not coa.is_header
    and (o.account_id is not null or a.account_id is not null)
  order by coa.code;
end;
$$;
grant execute on function public.get_trial_balance(uuid, uuid) to authenticated;
