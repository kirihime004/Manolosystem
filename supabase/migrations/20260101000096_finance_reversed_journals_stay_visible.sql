-- =========================================================================
-- Fix: v_general_ledger, get_trial_balance(), get_profit_and_loss(), and
-- get_balance_sheet() all filtered on journal_entries.status = 'POSTED'.
-- reverse_journal_entry() flips the ORIGINAL entry's status to 'REVERSED'
-- once it's corrected -- which made the original's real, historical lines
-- silently vanish from every report the moment it was reversed, leaving
-- only the reversal's lines. Standard accounting practice keeps both the
-- original and its reversal permanently visible in the ledger; REVERSED is
-- a label on a real posted fact, not a reason to hide it. Caught by
-- live-testing TEST 3 (reversal) followed by a balance sheet check, which
-- showed a lopsided total instead of the expected net-zero effect.
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
where je.status in ('POSTED', 'REVERSED')
  and (public.is_platform_superadmin() or public.has_permission(je.company_id, 'FINANCE.GL.VIEW'));

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
    where je.company_id = p_company_id and je.status in ('POSTED', 'REVERSED') and je.date < p.start_date
    group by jel.account_id
  ),
  activity as (
    select jel.account_id, sum(jel.base_debit) as d, sum(jel.base_credit) as c
    from public.journal_entry_lines jel
    join public.journal_entries je on je.id = jel.journal_entry_id
    cross join period p
    where je.company_id = p_company_id and je.status in ('POSTED', 'REVERSED') and je.date between p.start_date and p.end_date
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
  where je.company_id = p_company_id and je.status in ('POSTED', 'REVERSED')
    and je.date between p_start_date and p_end_date
    and coa.account_type in ('REVENUE', 'COGS', 'EXPENSE')
  group by coa.account_type, coa.code, coa.name
  order by coa.account_type, coa.code;
end;
$$;

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
  where je.company_id = p_company_id and je.status in ('POSTED', 'REVERSED') and je.date <= p_as_of_date
    and coa.account_type in ('ASSET', 'LIABILITY', 'EQUITY')
  group by coa.account_type, coa.code, coa.name
  order by coa.account_type, coa.code;
end;
$$;
