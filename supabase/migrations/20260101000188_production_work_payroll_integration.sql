-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 5: payroll
-- integration. ONE new, narrowly-scoped column on payroll_items -- the
-- exact same shape as this session's own employee_currency_id/
-- employee_exchange_rate addition (migration 167) -- never a redesign,
-- never a generic earnings bucket. This is the ONLY place production
-- earnings ever touch payroll, and it is never automatic: a Finance user
-- must explicitly select which earnings go into which run's item via
-- add_production_earnings_to_payroll_item().
-- =========================================================================

alter table public.payroll_items add column production_earnings numeric(14, 2) not null default 0;

-- calculate_payroll_item() redefined to include the new column in
-- gross_pay, otherwise identical to the current (089) version.
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

  v_gross := v_item.basic_salary + v_item.allowances + v_item.overtime_pay + v_item.bonuses + v_item.production_earnings;

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

-- ---------------------------------------------------------------------
-- add_production_earnings_to_payroll_item(): the one and only bridge
-- from Production earnings into Payroll. Requires the parent run to
-- still be PROCESSING/REVIEW (lock_payroll_items() enforces this
-- structurally regardless), requires every selected earning to belong
-- to the SAME employee as the payroll item, sums into the new column,
-- recalculates gross_pay, and moves each earning SENT_TO_FINANCE ->
-- IN_PAYROLL with a generated payroll_reference.
-- ---------------------------------------------------------------------
create or replace function public.add_production_earnings_to_payroll_item(
  p_payroll_item_id uuid,
  p_work_earning_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.payroll_items%rowtype;
  v_run public.payroll_runs%rowtype;
  v_id uuid;
  v_earning public.production_work_earnings%rowtype;
  v_total numeric := 0;
  v_reference text;
begin
  select * into v_item from public.payroll_items where id = p_payroll_item_id;
  if v_item.id is null then raise exception 'Payroll item not found'; end if;
  if not public.has_permission(v_item.company_id, 'FINANCE.PAYROLL.PROCESS') then
    raise exception 'Missing permission FINANCE.PAYROLL.PROCESS';
  end if;
  select * into v_run from public.payroll_runs where id = v_item.payroll_run_id;
  if v_run.status not in ('PROCESSING', 'REVIEW') then raise exception 'Payroll run is not editable'; end if;

  v_reference := 'PRW-' || to_char(now(), 'YYYYMMDD') || '-' || substr(p_payroll_item_id::text, 1, 8);

  foreach v_id in array p_work_earning_ids loop
    select * into v_earning from public.production_work_earnings where id = v_id;
    if v_earning.id is null then raise exception 'Work earning % not found', v_id; end if;
    if v_earning.status <> 'SENT_TO_FINANCE' then
      raise exception 'Work earning % is not sent to Finance (status: %)', v_id, v_earning.status;
    end if;
    if v_earning.employee_id <> v_item.employee_id then
      raise exception 'Work earning % does not belong to this payroll item''s employee', v_id;
    end if;

    v_total := v_total + coalesce(v_earning.base_currency_amount, v_earning.approved_amount);

    update public.production_work_earnings
    set status = 'IN_PAYROLL', payroll_item_id = p_payroll_item_id, payroll_reference = v_reference
    where id = v_id;

    perform public.log_production_event(v_earning.company_id, 'WORK_EARNING', v_id, 'PAYROLL_STATUS_CHANGED', 'SENT_TO_FINANCE', 'IN_PAYROLL',
      jsonb_build_object('payroll_item_id', p_payroll_item_id, 'payroll_reference', v_reference));

    insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
    select v_earning.company_id, 'PRODUCTION_WORK_SENT_TO_PAYROLL', 'Production earnings added to payroll',
      'Your approved production work was added to this pay period''s payroll.', 'production_work_earning', v_id, u.id
    from public.employees e join auth.users u on u.id = e.user_id where e.id = v_earning.employee_id
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end loop;

  update public.payroll_items set production_earnings = production_earnings + v_total where id = p_payroll_item_id;
  perform public.calculate_payroll_item(p_payroll_item_id);
end;
$$;

grant execute on function public.add_production_earnings_to_payroll_item(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- pay_payroll_run(): redefined only to append the cascade that moves
-- production_work_earnings referencing this run's items from IN_PAYROLL
-- to PAID -- completing the status ladder without any new payroll table.
-- Everything else is identical to the current (089) version.
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

  update public.production_work_earnings
  set status = 'PAID'
  where status = 'IN_PAYROLL'
    and payroll_item_id in (select id from public.payroll_items where payroll_run_id = p_payroll_run_id);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id, user_id)
  select pwe.company_id, 'PRODUCTION_WORK_PAID', 'Payment processed',
    'Your production earnings have been paid.', 'production_work_earning', pwe.id, u.id
  from public.production_work_earnings pwe
  join public.employees e on e.id = pwe.employee_id
  join auth.users u on u.id = e.user_id
  where pwe.status = 'PAID' and pwe.payroll_item_id in (select id from public.payroll_items where payroll_run_id = p_payroll_run_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  perform public.log_audit_event(v_run.company_id, 'PAYROLL_PAID', 'payroll_run', v_run.id,
    jsonb_build_object('total_net_pay', v_run.total_net_pay));

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_run.company_id, 'PAYROLL_PAID', 'Payroll paid', 'Payroll has been paid out.', 'payroll_run', v_run.id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  return v_je_id;
end;
$$;

grant execute on function public.pay_payroll_run(uuid, uuid) to authenticated;
