-- =========================================================================
-- Fix: generate_payroll_run() reads employee_compensation.basic_salary/
-- allowance and inserts them straight into payroll_items, ignoring
-- employee_compensation.currency_id entirely -- even though the payroll
-- run itself is always created in the company's base currency
-- (payroll_runs.currency_id := v_base_currency_id). An employee paid in a
-- non-base currency (e.g. a USD-paid remote hire at a PHP-base company)
-- had their raw USD number treated as if it were already PHP: wrong gross
-- pay, wrong statutory contributions, wrong net pay, wrong journal entry,
-- silently.
--
-- Fix: convert basic_salary/allowance to the base currency via
-- get_exchange_rate() before they ever reach payroll_items, and record
-- which currency/rate was used for audit purposes -- the exact quadruple
-- shape (source currency + rate, base amount) already used for
-- admin_assets and disposal accounting elsewhere in this app. Missing a
-- rate raises a clear error rather than silently posting $0 pay.
-- =========================================================================

alter table public.payroll_items add column employee_currency_id uuid references public.currencies(id);
alter table public.payroll_items add column employee_exchange_rate numeric(18, 6);

create or replace function public.generate_payroll_run(p_payroll_period_id uuid, p_run_type text default 'REGULAR')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period public.payroll_periods%rowtype;
  v_run_id uuid;
  v_base_currency_id uuid;
  v_emp record;
  v_rate numeric;
  v_basic_base numeric;
  v_allowance_base numeric;
  v_thirteenth_base numeric;
begin
  select * into v_period from public.payroll_periods where id = p_payroll_period_id;
  if v_period.id is null then raise exception 'Payroll period not found'; end if;
  if not public.has_permission(v_period.company_id, 'FINANCE.PAYROLL.PROCESS') then
    raise exception 'Missing permission FINANCE.PAYROLL.PROCESS';
  end if;
  if p_run_type not in ('REGULAR', 'THIRTEENTH_MONTH') then raise exception 'Invalid run type'; end if;

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = v_period.company_id;

  insert into public.payroll_runs (company_id, payroll_period_id, run_type, currency_id, processed_by, status)
  values (v_period.company_id, p_payroll_period_id, p_run_type, v_base_currency_id, auth.uid(), 'PROCESSING')
  returning id into v_run_id;

  for v_emp in
    select e.id as employee_id, vc.basic_salary, vc.allowance, vc.currency_id
    from public.employees e
    join public.employment_statuses es on es.id = e.employment_status_id and es.is_active_employment
    left join public.v_current_compensation vc on vc.employee_id = e.id
    where e.company_id = v_period.company_id
  loop
    v_rate := case
      when v_emp.currency_id is null then 1
      else public.get_exchange_rate(v_emp.currency_id, v_base_currency_id, v_period.end_date)
    end;
    if v_emp.currency_id is not null and v_rate is null then
      raise exception 'No exchange rate available to convert employee % compensation from its currency to the base currency as of %',
        v_emp.employee_id, v_period.end_date;
    end if;

    v_basic_base := round(coalesce(v_emp.basic_salary, 0) * v_rate, 2);
    v_allowance_base := round(coalesce(v_emp.allowance, 0) * v_rate, 2);

    if p_run_type = 'THIRTEENTH_MONTH' then
      -- 13th month pay = 1/12 of the year's total basic salary, each
      -- historical row converted at ITS OWN currency/effective_date
      -- before averaging -- a mid-year currency change must not silently
      -- mix unconverted amounts from two currencies into one average.
      select avg(round(
        vc2.basic_salary * coalesce(
          case when vc2.currency_id = v_base_currency_id then 1
            else public.get_exchange_rate(vc2.currency_id, v_base_currency_id, vc2.effective_date) end,
          1
        ), 2
      ))
      into v_thirteenth_base
      from public.employee_compensation vc2
      where vc2.employee_id = v_emp.employee_id
        and vc2.effective_date between date_trunc('year', v_period.start_date) and v_period.end_date;
    end if;

    insert into public.payroll_items (
      payroll_run_id, company_id, employee_id, basic_salary, allowances, overtime_hours,
      employee_currency_id, employee_exchange_rate
    )
    values (
      v_run_id, v_period.company_id, v_emp.employee_id,
      case when p_run_type = 'THIRTEENTH_MONTH' then coalesce(v_thirteenth_base, v_basic_base, 0) else v_basic_base end,
      case when p_run_type = 'THIRTEENTH_MONTH' then 0 else v_allowance_base end,
      case when p_run_type = 'THIRTEENTH_MONTH' then 0 else coalesce((
        select sum(o.total_hours) from public.overtime_requests o
        where o.employee_id = v_emp.employee_id and o.status = 'APPROVED'
          and o.work_date between v_period.start_date and v_period.end_date
      ), 0) end,
      v_emp.currency_id, v_rate
    );
  end loop;

  perform public.calculate_payroll_item(pi.id) from public.payroll_items pi where pi.payroll_run_id = v_run_id;
  perform public.recalculate_payroll_run_totals(v_run_id);

  return v_run_id;
end;
$$;
grant execute on function public.generate_payroll_run(uuid, text) to authenticated;
