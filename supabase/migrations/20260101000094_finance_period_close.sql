-- =========================================================================
-- PHASE 5: Finance & Accounting -- period close checklist, close, and
-- reopen (spec sections 4-5). Written last among the core RPCs since it
-- needs every other Finance table to exist to build a real checklist.
-- =========================================================================
create or replace function public.get_period_close_checklist(p_financial_period_id uuid)
returns table (item text, blocking_count integer)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_period public.financial_periods%rowtype;
begin
  select * into v_period from public.financial_periods where id = p_financial_period_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;
  if not public.is_platform_superadmin() and not public.has_permission(v_period.company_id, 'FINANCE.PERIODS.VIEW') then
    raise exception 'Missing permission FINANCE.PERIODS.VIEW';
  end if;

  return query
  select 'Unposted journals', count(*)::int from public.journal_entries
    where company_id = v_period.company_id and date between v_period.start_date and v_period.end_date
      and status in ('DRAFT', 'PENDING_APPROVAL', 'APPROVED')
  union all
  select 'Unapproved bills', count(*)::int from public.supplier_bills
    where company_id = v_period.company_id and bill_date between v_period.start_date and v_period.end_date
      and status in ('DRAFT', 'PENDING_APPROVAL')
  union all
  select 'Unapproved expenses', count(*)::int from public.expenses
    where company_id = v_period.company_id and expense_date between v_period.start_date and v_period.end_date
      and status in ('DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_REVIEW')
  union all
  select 'Unprocessed payroll', count(*)::int from public.payroll_runs pr
    join public.payroll_periods pp on pp.id = pr.payroll_period_id
    where pr.company_id = v_period.company_id
      and pp.end_date between v_period.start_date and v_period.end_date
      and pr.status not in ('PAID', 'CLOSED', 'CANCELLED')
  union all
  select 'Unreconciled bank transactions', count(*)::int from public.bank_transactions
    where company_id = v_period.company_id and transaction_date between v_period.start_date and v_period.end_date
      and not reconciled
  union all
  select 'Pending finance approvals', (
    (select count(*) from public.journal_entry_approvals jea join public.journal_entries je on je.id = jea.journal_entry_id
       where je.company_id = v_period.company_id and je.date between v_period.start_date and v_period.end_date and jea.decision = 'PENDING')
    + (select count(*) from public.supplier_bill_approvals sba join public.supplier_bills sb on sb.id = sba.supplier_bill_id
       where sb.company_id = v_period.company_id and sb.bill_date between v_period.start_date and v_period.end_date and sba.decision = 'PENDING')
    + (select count(*) from public.expense_approvals ea join public.expenses e on e.id = ea.expense_id
       where e.company_id = v_period.company_id and e.expense_date between v_period.start_date and v_period.end_date and ea.decision = 'PENDING')
  )::int;
end;
$$;
grant execute on function public.get_period_close_checklist(uuid) to authenticated;

create or replace function public.close_financial_period(p_financial_period_id uuid, p_force boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.financial_periods%rowtype;
  v_blocking record;
  v_blockers text := '';
begin
  select * into v_period from public.financial_periods where id = p_financial_period_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;
  if v_period.status <> 'OPEN' then raise exception 'Only an open period can be closed'; end if;
  if not public.has_permission(v_period.company_id, 'FINANCE.PERIODS.CLOSE') then
    raise exception 'Missing permission FINANCE.PERIODS.CLOSE';
  end if;

  if not p_force then
    for v_blocking in select * from public.get_period_close_checklist(p_financial_period_id) where blocking_count > 0 loop
      v_blockers := v_blockers || v_blocking.item || ' (' || v_blocking.blocking_count || '); ';
    end loop;
    if v_blockers <> '' then
      raise exception 'Cannot close period -- unresolved items: %', v_blockers;
    end if;
  end if;

  update public.financial_periods set status = 'CLOSED', closed_by = auth.uid(), closed_at = now() where id = p_financial_period_id;

  perform public.log_audit_event(v_period.company_id, 'FINANCIAL_PERIOD_CLOSED', 'financial_period', p_financial_period_id,
    jsonb_build_object('period_name', v_period.name, 'forced', p_force));
end;
$$;
grant execute on function public.close_financial_period(uuid, boolean) to authenticated;

create or replace function public.reopen_financial_period(p_financial_period_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.financial_periods%rowtype;
begin
  select * into v_period from public.financial_periods where id = p_financial_period_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;
  if v_period.status <> 'CLOSED' then raise exception 'Only a closed period can be reopened (locked periods cannot be reopened)'; end if;
  if not public.has_permission(v_period.company_id, 'FINANCE.PERIODS.CLOSE') then
    raise exception 'Missing permission FINANCE.PERIODS.CLOSE';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to reopen a financial period';
  end if;

  update public.financial_periods set status = 'OPEN', closed_by = null, closed_at = null where id = p_financial_period_id;

  perform public.log_audit_event(v_period.company_id, 'FINANCIAL_PERIOD_REOPENED', 'financial_period', p_financial_period_id,
    jsonb_build_object('period_name', v_period.name, 'reason', p_reason, 'reopened_by', auth.uid()));
end;
$$;
grant execute on function public.reopen_financial_period(uuid, text) to authenticated;

create or replace function public.lock_financial_period(p_financial_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.financial_periods%rowtype;
begin
  select * into v_period from public.financial_periods where id = p_financial_period_id;
  if v_period.id is null then raise exception 'Financial period not found'; end if;
  if v_period.status <> 'CLOSED' then raise exception 'Only a closed period can be locked'; end if;
  if not public.has_permission(v_period.company_id, 'FINANCE.PERIODS.CLOSE') then
    raise exception 'Missing permission FINANCE.PERIODS.CLOSE';
  end if;

  update public.financial_periods set status = 'LOCKED' where id = p_financial_period_id;
  perform public.log_audit_event(v_period.company_id, 'FINANCIAL_PERIOD_LOCKED', 'financial_period', p_financial_period_id,
    jsonb_build_object('period_name', v_period.name));
end;
$$;
grant execute on function public.lock_financial_period(uuid) to authenticated;
