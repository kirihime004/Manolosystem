-- =========================================================================
-- PHASE 5: Finance & Accounting -- Payroll logic. Pulls basic
-- salary/allowances from Phase 4's employee_compensation (via
-- v_current_compensation) and approved overtime hours from
-- overtime_requests -- never duplicates HR's data, only reads it.
-- Overtime pay, bonuses, and other deductions are Finance-editable per
-- line (auto-computing a peso overtime rate from salary alone would be a
-- guess HR never asked to make); statutory contributions and withholding
-- are computed from the company's own configured tax_rates.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Immutability guards. Without these, the RLS policies in migration 090
-- (which allow anyone holding FINANCE.PAYROLL.PROCESS/APPROVE/PAY to
-- UPDATE the row at all) would let a client PATCH payroll_runs.status
-- straight to 'PAID', or edit payroll_items.net_pay after approval,
-- completely bypassing approve_payroll_run()/pay_payroll_run()'s
-- journal-posting logic -- exactly the failure mode the lock-items
-- pattern elsewhere in this file set exists to prevent.
-- ---------------------------------------------------------------------
create or replace function public.before_update_payroll_run()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;
  if new.payroll_period_id <> old.payroll_period_id then raise exception 'payroll_period_id cannot be changed'; end if;

  if new.status is distinct from old.status then
    if current_setting('app.payroll_run_status_transition', true) <> new.status then
      raise exception 'Use approve_payroll_run()/pay_payroll_run() to change payroll run status';
    end if;
  end if;

  if old.status not in ('DRAFT', 'PROCESSING', 'REVIEW')
     and (new.total_gross_pay, new.total_deductions, new.total_employer_contributions, new.total_net_pay)
         is distinct from (old.total_gross_pay, old.total_deductions, old.total_employer_contributions, old.total_net_pay)
     and current_setting('app.payroll_run_status_transition', true) is distinct from new.status then
    raise exception 'Cannot edit totals of a % payroll run', old.status;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_payroll_run_trigger
  before update on public.payroll_runs
  for each row execute function public.before_update_payroll_run();

create or replace function public.lock_payroll_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.payroll_runs where id = coalesce(new.payroll_run_id, old.payroll_run_id);
  if v_status not in ('PROCESSING', 'REVIEW') then
    raise exception 'Cannot modify payroll items of a % run', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger lock_payroll_items_trigger
  before insert or update or delete on public.payroll_items
  for each row execute function public.lock_payroll_items();

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
    select e.id as employee_id, vc.basic_salary, vc.allowance
    from public.employees e
    join public.employment_statuses es on es.id = e.employment_status_id and es.is_active_employment
    left join public.v_current_compensation vc on vc.employee_id = e.id
    where e.company_id = v_period.company_id
  loop
    insert into public.payroll_items (payroll_run_id, company_id, employee_id, basic_salary, allowances, overtime_hours)
    values (
      v_run_id, v_period.company_id, v_emp.employee_id,
      case when p_run_type = 'THIRTEENTH_MONTH' then
        -- 13th month pay = 1/12 of the year's total basic salary. Since
        -- basic_salary is already a monthly rate, averaging the year's
        -- effective compensation rows already gives that 1/12 share --
        -- do not divide by 12 again.
        coalesce((
          select avg(vc2.basic_salary) from public.employee_compensation vc2
          where vc2.employee_id = v_emp.employee_id
            and vc2.effective_date between date_trunc('year', v_period.start_date) and v_period.end_date
        ), v_emp.basic_salary, 0)
      else coalesce(v_emp.basic_salary, 0) end,
      case when p_run_type = 'THIRTEENTH_MONTH' then 0 else coalesce(v_emp.allowance, 0) end,
      case when p_run_type = 'THIRTEENTH_MONTH' then 0 else coalesce((
        select sum(o.total_hours) from public.overtime_requests o
        where o.employee_id = v_emp.employee_id and o.status = 'APPROVED'
          and o.work_date between v_period.start_date and v_period.end_date
      ), 0) end
    );
  end loop;

  perform public.calculate_payroll_item(pi.id) from public.payroll_items pi where pi.payroll_run_id = v_run_id;
  perform public.recalculate_payroll_run_totals(v_run_id);

  return v_run_id;
end;
$$;
grant execute on function public.generate_payroll_run(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- calculate_payroll_item() -- (re)applies the company's configured tax
-- rates to one line. Call again after editing overtime_pay/bonuses/
-- other_deductions to refresh net pay before approval.
-- ---------------------------------------------------------------------
create or replace function public.calculate_payroll_item(p_payroll_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.payroll_items%rowtype;
  v_run public.payroll_runs%rowtype;
  v_gross numeric;
  v_rate record;
  v_sss_ee numeric := 0; v_sss_er numeric := 0;
  v_ph_ee numeric := 0; v_ph_er numeric := 0;
  v_pg_ee numeric := 0; v_pg_er numeric := 0;
  v_wht numeric := 0;
begin
  select * into v_item from public.payroll_items where id = p_payroll_item_id;
  if v_item.id is null then raise exception 'Payroll item not found'; end if;
  if not public.has_permission(v_item.company_id, 'FINANCE.PAYROLL.PROCESS') then
    raise exception 'Missing permission FINANCE.PAYROLL.PROCESS';
  end if;
  select * into v_run from public.payroll_runs where id = v_item.payroll_run_id;
  if v_run.status not in ('PROCESSING', 'REVIEW') then raise exception 'Payroll run is not editable'; end if;

  v_gross := v_item.basic_salary + v_item.allowances + v_item.overtime_pay + v_item.bonuses;

  for v_rate in
    select * from public.tax_rates
    where company_id = v_item.company_id and is_active
      and effective_date <= current_date and (expiry_date is null or expiry_date > current_date)
      and tax_type in ('SSS_EMPLOYEE', 'SSS_EMPLOYER', 'PHILHEALTH_EMPLOYEE', 'PHILHEALTH_EMPLOYER',
                        'PAGIBIG_EMPLOYEE', 'PAGIBIG_EMPLOYER', 'WITHHOLDING_TAX')
  loop
    case v_rate.tax_type
      when 'SSS_EMPLOYEE' then v_sss_ee := round(v_gross * v_rate.rate / 100, 2);
      when 'SSS_EMPLOYER' then v_sss_er := round(v_gross * v_rate.rate / 100, 2);
      when 'PHILHEALTH_EMPLOYEE' then v_ph_ee := round(v_gross * v_rate.rate / 100, 2);
      when 'PHILHEALTH_EMPLOYER' then v_ph_er := round(v_gross * v_rate.rate / 100, 2);
      when 'PAGIBIG_EMPLOYEE' then v_pg_ee := round(v_gross * v_rate.rate / 100, 2);
      when 'PAGIBIG_EMPLOYER' then v_pg_er := round(v_gross * v_rate.rate / 100, 2);
      when 'WITHHOLDING_TAX' then v_wht := round(v_gross * v_rate.rate / 100, 2);
      else null;
    end case;
  end loop;

  update public.payroll_items set
    gross_pay = v_gross,
    sss_employee = v_sss_ee, philhealth_employee = v_ph_ee, pagibig_employee = v_pg_ee, withholding_tax = v_wht,
    total_deductions = v_sss_ee + v_ph_ee + v_pg_ee + v_wht + other_deductions,
    sss_employer = v_sss_er, philhealth_employer = v_ph_er, pagibig_employer = v_pg_er,
    total_employer_contributions = v_sss_er + v_ph_er + v_pg_er,
    net_pay = v_gross - (v_sss_ee + v_ph_ee + v_pg_ee + v_wht + other_deductions)
  where id = p_payroll_item_id;
end;
$$;
grant execute on function public.calculate_payroll_item(uuid) to authenticated;

create or replace function public.recalculate_payroll_run_totals(p_payroll_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.payroll_runs where id = p_payroll_run_id;
  if v_company_id is null then raise exception 'Payroll run not found'; end if;
  if not public.has_permission(v_company_id, 'FINANCE.PAYROLL.VIEW') then
    raise exception 'Missing permission FINANCE.PAYROLL.VIEW';
  end if;

  update public.payroll_runs r set
    total_gross_pay = coalesce((select sum(gross_pay) from public.payroll_items where payroll_run_id = p_payroll_run_id), 0),
    total_deductions = coalesce((select sum(total_deductions) from public.payroll_items where payroll_run_id = p_payroll_run_id), 0),
    total_employer_contributions = coalesce((select sum(total_employer_contributions) from public.payroll_items where payroll_run_id = p_payroll_run_id), 0),
    total_net_pay = coalesce((select sum(net_pay) from public.payroll_items where payroll_run_id = p_payroll_run_id), 0)
  where r.id = p_payroll_run_id;
end;
$$;
grant execute on function public.recalculate_payroll_run_totals(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- approve_payroll_run() -- freezes the run and posts the accrual journal
-- from spec section 50: Debit Salary + Employer Contributions expense,
-- Credit Payroll/Tax/Contribution liabilities. Nothing is paid out yet.
-- ---------------------------------------------------------------------
create or replace function public.approve_payroll_run(p_payroll_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.payroll_runs%rowtype;
  v_je_id uuid;
  v_salary_account uuid;
  v_tax_payable uuid;
  v_payroll_liabilities uuid;
begin
  select * into v_run from public.payroll_runs where id = p_payroll_run_id;
  if v_run.id is null then raise exception 'Payroll run not found'; end if;
  if v_run.status not in ('PROCESSING', 'REVIEW') then raise exception 'Only a processing/review payroll run can be approved'; end if;
  if not public.has_permission(v_run.company_id, 'FINANCE.PAYROLL.APPROVE') then
    raise exception 'Missing permission FINANCE.PAYROLL.APPROVE';
  end if;
  if not exists (select 1 from public.payroll_items where payroll_run_id = p_payroll_run_id) then
    raise exception 'Payroll run has no items';
  end if;

  perform public.recalculate_payroll_run_totals(p_payroll_run_id);
  select * into v_run from public.payroll_runs where id = p_payroll_run_id;

  select id into v_salary_account from public.chart_of_accounts where company_id = v_run.company_id and code = '6100' and status = 'ACTIVE';
  select id into v_tax_payable from public.chart_of_accounts where company_id = v_run.company_id and code = '2200' and status = 'ACTIVE';
  select id into v_payroll_liabilities from public.chart_of_accounts where company_id = v_run.company_id and code = '2300' and status = 'ACTIVE';
  if v_salary_account is null then raise exception 'Salaries account (6100) not found'; end if;
  if v_tax_payable is null then raise exception 'Taxes Payable account (2200) not found'; end if;
  if v_payroll_liabilities is null then raise exception 'Payroll Liabilities account (2300) not found'; end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (v_run.company_id, current_date, 'payroll_run', v_run.id, 'Payroll accrual for period', v_run.currency_id, v_run.currency_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
  values (v_je_id, 1, v_salary_account, 'Gross salaries', v_run.total_gross_pay, 0);
  if v_run.total_employer_contributions > 0 then
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
    values (v_je_id, 2, v_salary_account, 'Employer contributions', v_run.total_employer_contributions, 0);
  end if;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
  values (v_je_id, 3, v_payroll_liabilities, 'Net pay payable to employees', 0, v_run.total_net_pay);

  if (v_run.total_deductions - coalesce((select sum(withholding_tax) from public.payroll_items where payroll_run_id = p_payroll_run_id), 0)) > 0 then
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
    values (v_je_id, 4, v_payroll_liabilities, 'Employee statutory contributions payable', 0,
      v_run.total_deductions - coalesce((select sum(withholding_tax) from public.payroll_items where payroll_run_id = p_payroll_run_id), 0));
  end if;

  if coalesce((select sum(withholding_tax) from public.payroll_items where payroll_run_id = p_payroll_run_id), 0) > 0 then
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
    values (v_je_id, 5, v_tax_payable, 'Withholding tax payable', 0,
      (select sum(withholding_tax) from public.payroll_items where payroll_run_id = p_payroll_run_id));
  end if;

  if v_run.total_employer_contributions > 0 then
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
    values (v_je_id, 6, v_payroll_liabilities, 'Employer statutory contributions payable', 0, v_run.total_employer_contributions);
  end if;

  perform public.post_journal_entry(v_je_id);

  perform set_config('app.payroll_run_status_transition', 'APPROVED', true);
  update public.payroll_runs set status = 'APPROVED', approved_by = auth.uid(), approved_at = now(), journal_entry_id = v_je_id
  where id = p_payroll_run_id;

  update public.payroll_periods set status = 'APPROVED' where id = v_run.payroll_period_id;

  perform public.log_audit_event(v_run.company_id, 'PAYROLL_APPROVED', 'payroll_run', v_run.id,
    jsonb_build_object('total_net_pay', v_run.total_net_pay));

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_run.company_id, 'PAYROLL_APPROVED', 'Payroll approved',
    'Payroll for the period has been approved and is ready for payment.', 'payroll_run', v_run.id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;
grant execute on function public.approve_payroll_run(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- pay_payroll_run() -- disburses net pay only (Debit Payroll Liabilities /
-- Credit Cash). Statutory remittances stay as liabilities for a separate
-- remittance workflow (noted as future work in the final report).
-- ---------------------------------------------------------------------
create or replace function public.pay_payroll_run(p_payroll_run_id uuid, p_cash_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.payroll_runs%rowtype;
  v_cash_account public.cash_accounts%rowtype;
  v_payroll_liabilities uuid;
  v_je_id uuid;
  v_rate_to_cash numeric;
  v_cash_amount numeric;
begin
  select * into v_run from public.payroll_runs where id = p_payroll_run_id;
  if v_run.id is null then raise exception 'Payroll run not found'; end if;
  if v_run.status <> 'APPROVED' then raise exception 'Only an approved payroll run can be paid'; end if;
  if not public.has_permission(v_run.company_id, 'FINANCE.PAYROLL.PAY') then
    raise exception 'Missing permission FINANCE.PAYROLL.PAY';
  end if;

  select * into v_cash_account from public.cash_accounts where id = p_cash_account_id and company_id = v_run.company_id;
  if v_cash_account.id is null then raise exception 'Cash/bank account not found'; end if;

  select id into v_payroll_liabilities from public.chart_of_accounts where company_id = v_run.company_id and code = '2300' and status = 'ACTIVE';
  if v_payroll_liabilities is null then raise exception 'Payroll Liabilities account (2300) not found'; end if;

  -- v_run.currency_id is already the company base currency (set when the
  -- run was generated) -- the journal posts in that currency directly,
  -- exactly like every other journal entry. Only the physical
  -- bank_transactions record needs converting into the paying account's
  -- own currency, if it differs.
  if v_run.currency_id = v_cash_account.currency_id then
    v_cash_amount := v_run.total_net_pay;
  else
    v_rate_to_cash := public.get_exchange_rate(v_run.currency_id, v_cash_account.currency_id, current_date);
    if v_rate_to_cash is null then raise exception 'No exchange rate is available to convert payroll into the cash account currency'; end if;
    v_cash_amount := round(v_run.total_net_pay * v_rate_to_cash, 2);
  end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (v_run.company_id, current_date, 'payroll_run', v_run.id, 'Payroll payment', v_run.currency_id, v_run.currency_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
  values (v_je_id, 1, v_payroll_liabilities, 'Net pay disbursed', v_run.total_net_pay, 0);
  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit)
  values (v_je_id, 2, v_cash_account.gl_account_id, 'Net pay disbursed', 0, v_run.total_net_pay);

  perform public.post_journal_entry(v_je_id);

  insert into public.bank_transactions (company_id, cash_account_id, transaction_date, transaction_type, direction, amount, currency_id, description, reference_type, reference_id, journal_entry_id)
  values (v_run.company_id, p_cash_account_id, current_date, 'WITHDRAWAL', 'OUT', v_cash_amount, v_cash_account.currency_id,
    'Payroll payment', 'payroll_run', v_run.id, v_je_id);

  perform set_config('app.payroll_run_status_transition', 'PAID', true);
  update public.payroll_runs set status = 'PAID', paid_at = now(), payment_journal_entry_id = v_je_id where id = p_payroll_run_id;
  update public.payroll_periods set status = 'PAID' where id = v_run.payroll_period_id;

  perform public.log_audit_event(v_run.company_id, 'PAYROLL_PAID', 'payroll_run', v_run.id,
    jsonb_build_object('total_net_pay', v_run.total_net_pay));

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_run.company_id, 'PAYROLL_PAID', 'Payroll paid', 'Payroll has been paid out.', 'payroll_run', v_run.id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  return v_je_id;
end;
$$;
grant execute on function public.pay_payroll_run(uuid, uuid) to authenticated;
