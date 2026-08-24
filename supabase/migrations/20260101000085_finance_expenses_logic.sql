-- =========================================================================
-- PHASE 5: Finance & Accounting -- Expense claim logic. Workflow per spec
-- section 33: Employee -> approval chain (reusing the same generic
-- approval_policies engine as everything else -- EXPENSE already has a
-- seeded default requiring FINANCE.EXPENSES.APPROVE) -> Finance payment ->
-- accounting. The distinct MANAGER_APPROVED/FINANCE_REVIEW states stay in
-- the CHECK constraint for a company that wants a multi-tier chain (add
-- more approval_policies rows), but the default single-tier flow here only
-- drives SUBMITTED -> APPROVED -> PAID plus REJECTED/CANCELLED.
-- =========================================================================
create or replace function public.default_expense_account(p_company_id uuid, p_category text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_account_by_code(p_company_id, case p_category
    when 'TRAVEL' then '6600'
    when 'TRANSPORTATION' then '6600'
    when 'IT' then '6500'
    when 'OFFICE' then '6700'
    when 'PRODUCTION' then '5100'
    else '6900'
  end);
$$;
grant execute on function public.default_expense_account(uuid, text) to authenticated;

create or replace function public.before_insert_expense()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.expense_number := public.generate_asset_code(new.company_id, 'EXP');
  return new;
end;
$$;

create trigger before_insert_expense_trigger
  before insert on public.expenses
  for each row execute function public.before_insert_expense();

create or replace function public.before_update_expense()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;
  if new.expense_number <> old.expense_number then raise exception 'expense_number cannot be changed'; end if;

  if new.status is distinct from old.status then
    if current_setting('app.expense_status_transition', true) <> new.status then
      raise exception 'Use submit_expense()/decide_expense_approval()/pay_expense()/cancel_expense() to change status';
    end if;
  end if;

  if old.status <> 'DRAFT'
     and (new.amount, new.category, new.currency_id, new.employee_id) is distinct from (old.amount, old.category, old.currency_id, old.employee_id) then
    raise exception 'Only draft expense claims can be freely edited';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_expense_trigger
  before update on public.expenses
  for each row execute function public.before_update_expense();

create or replace function public.submit_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exp public.expenses%rowtype;
  v_base_currency_id uuid;
  v_rate numeric;
  v_policy record;
begin
  select * into v_exp from public.expenses where id = p_expense_id;
  if v_exp.id is null then raise exception 'Expense claim not found'; end if;
  if v_exp.status <> 'DRAFT' then raise exception 'Only draft expense claims can be submitted'; end if;
  if not public.is_own_employee(v_exp.employee_id) and not public.has_permission(v_exp.company_id, 'FINANCE.EXPENSES.APPROVE') then
    raise exception 'Missing permission';
  end if;

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = v_exp.company_id;
  if v_exp.currency_id = v_base_currency_id then
    v_rate := 1;
  else
    v_rate := public.get_exchange_rate(v_exp.currency_id, v_base_currency_id, v_exp.expense_date);
    if v_rate is null then raise exception 'No exchange rate is available to convert this claim into the company base currency'; end if;
  end if;

  perform set_config('app.expense_status_transition', 'SUBMITTED', true);
  update public.expenses set
    status = 'SUBMITTED', base_currency_id = v_base_currency_id, exchange_rate = v_rate,
    base_currency_amount = round(amount * v_rate, 2),
    account_id = coalesce(account_id, public.default_expense_account(v_exp.company_id, v_exp.category))
  where id = p_expense_id;

  for v_policy in
    select * from public.get_applicable_approval_policies(v_exp.company_id, 'EXPENSE', round(v_exp.amount * v_rate, 2), v_base_currency_id)
  loop
    insert into public.expense_approvals (company_id, expense_id, required_permission, approval_level, sequence)
    values (v_exp.company_id, p_expense_id, v_policy.required_permission, v_policy.approval_sequence, v_policy.approval_sequence);
  end loop;

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_exp.company_id, 'EXPENSE_SUBMITTED', 'Expense claim submitted',
    v_exp.expense_number || ' was submitted and is awaiting approval.', 'expense', p_expense_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;
end;
$$;
grant execute on function public.submit_expense(uuid) to authenticated;

create or replace function public.decide_expense_approval(
  p_approval_id uuid, p_decision text, p_comments text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.expense_approvals%rowtype;
  v_exp public.expenses%rowtype;
  v_policy public.approval_policies%rowtype;
  v_earlier_pending int;
  v_remaining_pending int;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_approval from public.expense_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_exp from public.expenses where id = v_approval.expense_id;
  if v_exp.status not in ('SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_REVIEW') then
    raise exception 'Expense claim is not awaiting approval';
  end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  if public.is_own_employee(v_exp.employee_id) then
    select * into v_policy from public.approval_policies
      where company_id = v_approval.company_id and module = 'EXPENSE' and approval_sequence = v_approval.sequence and enabled
      limit 1;
    if v_policy.id is not null and not v_policy.allow_self_approval then
      raise exception 'You cannot approve your own expense claim';
    end if;
  end if;

  select count(*) into v_earlier_pending from public.expense_approvals
    where expense_id = v_approval.expense_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then raise exception 'An earlier approval level is still pending'; end if;

  update public.expense_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  if p_decision = 'REJECTED' then
    perform set_config('app.expense_status_transition', 'REJECTED', true);
    update public.expenses set status = 'REJECTED' where id = v_exp.id;
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (v_approval.company_id, 'EXPENSE_REJECTED', 'Expense claim rejected',
      v_exp.expense_number || ' was rejected.', 'expense', v_exp.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    return;
  end if;

  select count(*) into v_remaining_pending from public.expense_approvals
    where expense_id = v_exp.id and decision = 'PENDING';

  if v_remaining_pending = 0 then
    perform set_config('app.expense_status_transition', 'APPROVED', true);
    update public.expenses set status = 'APPROVED', approver_id = auth.uid() where id = v_exp.id;
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (v_approval.company_id, 'EXPENSE_APPROVED', 'Expense claim approved',
      v_exp.expense_number || ' has been approved and is ready for payment.', 'expense', v_exp.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
  end if;
end;
$$;
grant execute on function public.decide_expense_approval(uuid, text, text) to authenticated;

create or replace function public.cancel_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exp public.expenses%rowtype;
begin
  select * into v_exp from public.expenses where id = p_expense_id;
  if v_exp.id is null then raise exception 'Expense claim not found'; end if;
  if v_exp.status <> 'DRAFT' then raise exception 'Only draft claims can be cancelled'; end if;
  if not public.is_own_employee(v_exp.employee_id) and not public.has_permission(v_exp.company_id, 'FINANCE.EXPENSES.APPROVE') then
    raise exception 'Missing permission';
  end if;
  perform set_config('app.expense_status_transition', 'CANCELLED', true);
  update public.expenses set status = 'CANCELLED' where id = p_expense_id;
end;
$$;
grant execute on function public.cancel_expense(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- pay_expense() -- the "Finance Review -> Approval -> Payment -> Accounting"
-- tail of the workflow: posts Debit Expense / Credit Cash and, if the
-- claim is linked to a budget, an EXPENSE row on the Phase 2 budget ledger.
-- ---------------------------------------------------------------------
create or replace function public.pay_expense(p_expense_id uuid, p_cash_account_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_exp public.expenses%rowtype;
  v_cash_account public.cash_accounts%rowtype;
  v_company_base_currency_id uuid;
  v_je_id uuid;
  v_rate_to_base numeric;
  v_base_amount numeric;
  v_rate_to_cash numeric;
  v_cash_amount numeric;
begin
  select * into v_exp from public.expenses where id = p_expense_id;
  if v_exp.id is null then raise exception 'Expense claim not found'; end if;
  if v_exp.status <> 'APPROVED' then raise exception 'Only approved claims can be paid'; end if;
  if not public.has_permission(v_exp.company_id, 'FINANCE.EXPENSES.PAY') then
    raise exception 'Missing permission FINANCE.EXPENSES.PAY';
  end if;

  select * into v_cash_account from public.cash_accounts where id = p_cash_account_id and company_id = v_exp.company_id;
  if v_cash_account.id is null then raise exception 'Cash/bank account not found'; end if;

  -- Same fix as record_supplier_payment(): the journal always posts in the
  -- company's real base currency, never the cash account's own currency.
  v_company_base_currency_id := v_exp.base_currency_id;
  if v_company_base_currency_id is null then
    select base_currency_id into v_company_base_currency_id from public.company_currency_settings where company_id = v_exp.company_id;
  end if;
  if v_company_base_currency_id is null then raise exception 'Company base currency is not configured'; end if;

  if v_exp.currency_id = v_company_base_currency_id then
    v_rate_to_base := 1;
  else
    v_rate_to_base := public.get_exchange_rate(v_exp.currency_id, v_company_base_currency_id, current_date);
    if v_rate_to_base is null then raise exception 'No exchange rate is available to convert this claim into the company base currency'; end if;
  end if;
  v_base_amount := round(v_exp.amount * v_rate_to_base, 2);

  if v_exp.currency_id = v_cash_account.currency_id then
    v_cash_amount := v_exp.amount;
  else
    v_rate_to_cash := public.get_exchange_rate(v_exp.currency_id, v_cash_account.currency_id, current_date);
    if v_rate_to_cash is null then raise exception 'No exchange rate is available to convert this claim into the cash account currency'; end if;
    v_cash_amount := round(v_exp.amount * v_rate_to_cash, 2);
  end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (v_exp.company_id, current_date, 'expense', v_exp.id, 'Expense claim ' || v_exp.expense_number, v_company_base_currency_id, v_company_base_currency_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, employee_id, department_id, cost_center_id, customer_id, project_id)
  values (v_je_id, 1, coalesce(v_exp.account_id, public.default_expense_account(v_exp.company_id, v_exp.category)),
    v_exp.description, v_base_amount, 0, v_exp.employee_id, v_exp.department_id, v_exp.cost_center_id, v_exp.customer_id, v_exp.project_id);
  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, employee_id)
  values (v_je_id, 2, v_cash_account.gl_account_id, 'Expense claim ' || v_exp.expense_number, 0, v_base_amount, v_exp.employee_id);

  perform public.post_journal_entry(v_je_id);

  insert into public.bank_transactions (company_id, cash_account_id, transaction_date, transaction_type, direction, amount, currency_id, description, reference_type, reference_id, journal_entry_id)
  values (v_exp.company_id, p_cash_account_id, current_date, 'WITHDRAWAL', 'OUT', v_cash_amount, v_cash_account.currency_id,
    'Expense claim ' || v_exp.expense_number, 'expense', v_exp.id, v_je_id);

  if v_exp.budget_id is not null then
    insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
    values (v_exp.company_id, v_exp.budget_id, v_exp.budget_category_id, coalesce(v_exp.base_currency_amount, v_exp.amount),
      coalesce(v_exp.base_currency_id, v_exp.currency_id), 'EXPENSE', 'expense', v_exp.id, 'Expense ' || v_exp.expense_number, auth.uid());
  end if;

  perform set_config('app.expense_status_transition', 'PAID', true);
  update public.expenses set status = 'PAID', journal_entry_id = v_je_id, paid_via_cash_account_id = p_cash_account_id, paid_at = now()
  where id = p_expense_id;

  perform public.log_audit_event(v_exp.company_id, 'EXPENSE_PAID', 'expense', v_exp.id,
    jsonb_build_object('expense_number', v_exp.expense_number, 'amount', v_exp.amount));

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_exp.company_id, 'PAYMENT_COMPLETED', 'Expense claim paid',
    v_exp.expense_number || ' has been paid.', 'expense', v_exp.id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  return v_je_id;
end;
$$;
grant execute on function public.pay_expense(uuid, uuid) to authenticated;
