-- =========================================================================
-- PHASE 5: Finance & Accounting -- Accounts Payable logic: numbering,
-- three-way matching, approval, payment recording, and the journal
-- entries each of those posts automatically.
-- =========================================================================
create or replace function public.get_account_by_code(p_company_id uuid, p_code text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from public.chart_of_accounts where company_id = p_company_id and code = p_code and status = 'ACTIVE';
$$;
grant execute on function public.get_account_by_code(uuid, text) to authenticated;

create or replace function public.before_insert_supplier_bill()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.bill_number := public.generate_asset_code(new.company_id, 'BILL');
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_supplier_bill_trigger
  before insert on public.supplier_bills
  for each row execute function public.before_insert_supplier_bill();

create or replace function public.before_update_supplier_bill()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;
  if new.bill_number <> old.bill_number then raise exception 'bill_number cannot be changed'; end if;

  if new.status is distinct from old.status then
    if current_setting('app.bill_status_transition', true) <> new.status then
      raise exception 'Use submit_supplier_bill()/decide_supplier_bill_approval()/record_supplier_payment()/void_supplier_bill() to change status';
    end if;
  end if;

  if old.status <> 'DRAFT'
     and (new.subtotal, new.tax, new.discount, new.total, new.supplier_id, new.currency_id)
         is distinct from (old.subtotal, old.tax, old.discount, old.total, old.supplier_id, old.currency_id) then
    raise exception 'Only draft bills can be freely edited';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_supplier_bill_trigger
  before update on public.supplier_bills
  for each row execute function public.before_update_supplier_bill();

-- Line totals derive from their own fields, mirroring purchase_order_items.
create or replace function public.before_write_supplier_bill_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.supplier_bills where id = new.supplier_bill_id;
  new.line_total := round(new.quantity * new.unit_price + new.tax - new.discount, 2);
  return new;
end;
$$;

create trigger before_write_supplier_bill_item_trigger
  before insert or update on public.supplier_bill_items
  for each row execute function public.before_write_supplier_bill_item();

-- Items of a bill that has left DRAFT are locked: the journal entry posted
-- at approval already reflects the bill's totals as of that moment, so
-- letting items change afterward would silently desync the ledger from
-- what the bill displays.
create or replace function public.lock_supplier_bill_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.supplier_bills where id = coalesce(new.supplier_bill_id, old.supplier_bill_id);
  if v_status <> 'DRAFT' then
    raise exception 'Cannot modify items of a % bill', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger lock_supplier_bill_items_trigger
  before insert or update or delete on public.supplier_bill_items
  for each row execute function public.lock_supplier_bill_items();

-- Keep the bill's own subtotal/total in sync with its items whenever they change.
create or replace function public.after_write_supplier_bill_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill_id uuid := coalesce(new.supplier_bill_id, old.supplier_bill_id);
begin
  update public.supplier_bills sb
  set subtotal = coalesce((select sum(quantity * unit_price) from public.supplier_bill_items where supplier_bill_id = v_bill_id), 0),
      tax = coalesce((select sum(tax) from public.supplier_bill_items where supplier_bill_id = v_bill_id), 0),
      discount = coalesce((select sum(discount) from public.supplier_bill_items where supplier_bill_id = v_bill_id), 0),
      total = coalesce((select sum(line_total) from public.supplier_bill_items where supplier_bill_id = v_bill_id), 0)
  where sb.id = v_bill_id and sb.status = 'DRAFT';
  return null;
end;
$$;

create trigger after_write_supplier_bill_item_trigger
  after insert or update or delete on public.supplier_bill_items
  for each row execute function public.after_write_supplier_bill_item();

-- ---------------------------------------------------------------------
-- Three-way match: PO quantity vs received quantity vs billed quantity,
-- per line. Never auto-approves on mismatch -- just sets a visible flag
-- for the human approval step to see.
-- ---------------------------------------------------------------------
create or replace function public.run_three_way_match(p_supplier_bill_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.supplier_bills%rowtype;
  v_mismatch boolean := false;
begin
  select * into v_bill from public.supplier_bills where id = p_supplier_bill_id;
  if v_bill.id is null then raise exception 'Supplier bill not found'; end if;

  if v_bill.purchase_order_id is null then
    update public.supplier_bills set match_status = 'NOT_APPLICABLE', matched_at = now() where id = p_supplier_bill_id;
    return 'NOT_APPLICABLE';
  end if;

  select exists (
    select 1
    from public.supplier_bill_items sbi
    join public.purchase_order_items poi on poi.id = sbi.purchase_order_item_id
    where sbi.supplier_bill_id = p_supplier_bill_id
      and sbi.purchase_order_item_id is not null
      and sbi.quantity > poi.received_quantity
  ) into v_mismatch;

  update public.supplier_bills
  set match_status = case when v_mismatch then 'MISMATCH' else 'MATCHED' end, matched_at = now()
  where id = p_supplier_bill_id;

  return case when v_mismatch then 'MISMATCH' else 'MATCHED' end;
end;
$$;
grant execute on function public.run_three_way_match(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- submit_supplier_bill() -- runs matching, resolves the base-currency
-- snapshot, and starts (or skips, if uniquely unnecessary) the approval
-- chain. BILL always has a default seeded policy so this always routes
-- through PENDING_APPROVAL.
-- ---------------------------------------------------------------------
create or replace function public.submit_supplier_bill(p_supplier_bill_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.supplier_bills%rowtype;
  v_base_currency_id uuid;
  v_rate numeric;
  v_policy record;
begin
  select * into v_bill from public.supplier_bills where id = p_supplier_bill_id;
  if v_bill.id is null then raise exception 'Supplier bill not found'; end if;
  if v_bill.status <> 'DRAFT' then raise exception 'Only draft bills can be submitted'; end if;
  if not public.has_permission(v_bill.company_id, 'FINANCE.AP.CREATE') then
    raise exception 'Missing permission FINANCE.AP.CREATE';
  end if;
  if v_bill.total <= 0 then raise exception 'A bill needs at least one item before it can be submitted'; end if;

  perform public.run_three_way_match(p_supplier_bill_id);

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = v_bill.company_id;
  if v_bill.currency_id = v_base_currency_id then
    v_rate := 1;
  else
    v_rate := public.get_exchange_rate(v_bill.currency_id, v_base_currency_id, v_bill.bill_date);
    if v_rate is null then raise exception 'No exchange rate is available to convert this bill into the company base currency'; end if;
  end if;

  perform set_config('app.bill_status_transition', 'PENDING_APPROVAL', true);
  update public.supplier_bills set
    status = 'PENDING_APPROVAL',
    base_currency_id = v_base_currency_id,
    exchange_rate = v_rate,
    base_currency_total = round(total * v_rate, 2)
  where id = p_supplier_bill_id;

  for v_policy in
    select * from public.get_applicable_approval_policies(v_bill.company_id, 'BILL', round(v_bill.total * v_rate, 2), v_base_currency_id)
  loop
    insert into public.supplier_bill_approvals (company_id, supplier_bill_id, required_permission, approval_level, sequence)
    values (v_bill.company_id, p_supplier_bill_id, v_policy.required_permission, v_policy.approval_sequence, v_policy.approval_sequence);
  end loop;
end;
$$;
grant execute on function public.submit_supplier_bill(uuid) to authenticated;

create or replace function public.decide_supplier_bill_approval(
  p_approval_id uuid, p_decision text, p_comments text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_approval public.supplier_bill_approvals%rowtype;
  v_bill public.supplier_bills%rowtype;
  v_earlier_pending int;
  v_remaining_pending int;
  v_je_id uuid;
  v_item record;
  v_ap_account uuid;
  v_tax_account uuid;
  v_line_no int := 1;
begin
  if p_decision not in ('APPROVED', 'REJECTED') then raise exception 'Invalid decision'; end if;

  select * into v_approval from public.supplier_bill_approvals where id = p_approval_id;
  if v_approval.id is null then raise exception 'Approval record not found'; end if;
  if v_approval.decision <> 'PENDING' then raise exception 'This approval has already been decided'; end if;

  select * into v_bill from public.supplier_bills where id = v_approval.supplier_bill_id;
  if v_bill.status <> 'PENDING_APPROVAL' then raise exception 'Bill is not awaiting approval'; end if;

  if not public.has_permission(v_approval.company_id, v_approval.required_permission) then
    raise exception 'Missing permission %', v_approval.required_permission;
  end if;

  select count(*) into v_earlier_pending from public.supplier_bill_approvals
    where supplier_bill_id = v_approval.supplier_bill_id and sequence < v_approval.sequence and decision = 'PENDING';
  if v_earlier_pending > 0 then raise exception 'An earlier approval level is still pending'; end if;

  update public.supplier_bill_approvals
  set decision = p_decision, decided_at = now(), comments = p_comments, approver_id = auth.uid()
  where id = p_approval_id;

  if p_decision = 'REJECTED' then
    perform set_config('app.bill_status_transition', 'DRAFT', true);
    update public.supplier_bills set status = 'DRAFT' where id = v_bill.id;
    return;
  end if;

  select count(*) into v_remaining_pending from public.supplier_bill_approvals
    where supplier_bill_id = v_bill.id and decision = 'PENDING';
  if v_remaining_pending > 0 then
    return;
  end if;

  -- Fully approved: post the accounting entry (Debit each item's expense
  -- account net of tax, Debit tax separately to Taxes Payable so the
  -- expense account isn't overstated by the tax amount, Credit Accounts
  -- Payable for the tax-inclusive total) and, if linked to a budget, the
  -- corresponding EXPENSE row on the existing Phase 2 budget ledger.
  select id into v_ap_account from public.chart_of_accounts
    where company_id = v_bill.company_id and code = '2100' and status = 'ACTIVE';
  if v_ap_account is null then raise exception 'Accounts Payable account (2100) not found'; end if;
  select id into v_tax_account from public.chart_of_accounts
    where company_id = v_bill.company_id and code = '2200' and status = 'ACTIVE';
  if v_tax_account is null then raise exception 'Taxes Payable account (2200) not found'; end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (v_bill.company_id, v_bill.bill_date, 'supplier_bill', v_bill.id,
    'Supplier bill ' || v_bill.bill_number, v_bill.currency_id, v_bill.base_currency_id)
  returning id into v_je_id;

  for v_item in select * from public.supplier_bill_items where supplier_bill_id = v_bill.id order by created_at loop
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, department_id, cost_center_id, supplier_id)
    values (v_je_id, v_line_no, coalesce(v_item.account_id, public.get_account_by_code(v_bill.company_id, '6900')),
      v_item.description, v_item.line_total - v_item.tax, 0, v_bill.department_id, v_bill.cost_center_id, v_bill.supplier_id);
    v_line_no := v_line_no + 1;
    if v_item.tax > 0 then
      insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, supplier_id)
      values (v_je_id, v_line_no, v_tax_account, 'Input tax: ' || v_item.description, v_item.tax, 0, v_bill.supplier_id);
      v_line_no := v_line_no + 1;
    end if;
  end loop;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, supplier_id)
  values (v_je_id, v_line_no, v_ap_account, 'Accounts payable: ' || v_bill.bill_number, 0, v_bill.total, v_bill.supplier_id);

  perform public.post_journal_entry(v_je_id);

  if v_bill.budget_id is not null then
    insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, reference_type, reference_id, description, created_by)
    values (v_bill.company_id, v_bill.budget_id, v_bill.budget_category_id, coalesce(v_bill.base_currency_total, v_bill.total),
      coalesce(v_bill.base_currency_id, v_bill.currency_id), 'EXPENSE', 'supplier_bill', v_bill.id,
      'Bill ' || v_bill.bill_number, auth.uid());
  end if;

  perform set_config('app.bill_status_transition', 'APPROVED', true);
  update public.supplier_bills set status = 'APPROVED', journal_entry_id = v_je_id where id = v_bill.id;

  perform public.log_audit_event(v_bill.company_id, 'BILL_APPROVED', 'supplier_bill', v_bill.id,
    jsonb_build_object('bill_number', v_bill.bill_number, 'total', v_bill.total));
end;
$$;
grant execute on function public.decide_supplier_bill_approval(uuid, text, text) to authenticated;

create or replace function public.void_supplier_bill(p_supplier_bill_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.supplier_bills%rowtype;
begin
  select * into v_bill from public.supplier_bills where id = p_supplier_bill_id;
  if v_bill.id is null then raise exception 'Supplier bill not found'; end if;
  if v_bill.status in ('PAID', 'PARTIALLY_PAID') then raise exception 'Cannot void a bill that has payments applied'; end if;
  if v_bill.status = 'DRAFT' then
    if not public.has_permission(v_bill.company_id, 'FINANCE.AP.CREATE') then
      raise exception 'Missing permission FINANCE.AP.CREATE';
    end if;
  else
    -- An APPROVED bill already posted its accrual journal entry -- voiding
    -- it must reverse that journal, not just flip the status, or the
    -- ledger keeps a permanent record of an expense that no longer exists.
    if not public.has_permission(v_bill.company_id, 'FINANCE.AP.APPROVE') then
      raise exception 'Missing permission FINANCE.AP.APPROVE';
    end if;
    if v_bill.journal_entry_id is not null then
      perform public.reverse_journal_entry(v_bill.journal_entry_id, coalesce(p_reason, 'Bill voided'));
    end if;
  end if;
  perform set_config('app.bill_status_transition', 'VOID', true);
  update public.supplier_bills set status = 'VOID', notes = coalesce(notes || E'\n', '') || 'Voided: ' || coalesce(p_reason, '') where id = p_supplier_bill_id;
end;
$$;
grant execute on function public.void_supplier_bill(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- record_supplier_payment() -- prevents overpayment, updates the bill's
-- running paid_amount/status, and posts Debit AP / Credit Cash-or-Bank.
-- ---------------------------------------------------------------------
create or replace function public.record_supplier_payment(
  p_supplier_bill_id uuid,
  p_cash_account_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_payment_method text default 'BANK_TRANSFER',
  p_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bill public.supplier_bills%rowtype;
  v_cash_account public.cash_accounts%rowtype;
  v_company_base_currency_id uuid;
  v_ap_account uuid;
  v_outstanding numeric;
  v_payment_id uuid;
  v_je_id uuid;
  v_rate_to_base numeric;
  v_base_amount numeric;
  v_rate_to_cash numeric;
  v_cash_amount numeric;
begin
  select * into v_bill from public.supplier_bills where id = p_supplier_bill_id;
  if v_bill.id is null then raise exception 'Supplier bill not found'; end if;
  if v_bill.status not in ('APPROVED', 'PARTIALLY_PAID') then
    raise exception 'Only approved bills can be paid';
  end if;
  if not public.has_permission(v_bill.company_id, 'FINANCE.AP.PAY') then
    raise exception 'Missing permission FINANCE.AP.PAY';
  end if;
  if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  v_outstanding := v_bill.total - v_bill.paid_amount;
  if p_amount > v_outstanding then
    raise exception 'Payment of % exceeds the outstanding balance of %', p_amount, v_outstanding;
  end if;

  select * into v_cash_account from public.cash_accounts where id = p_cash_account_id and company_id = v_bill.company_id;
  if v_cash_account.id is null then raise exception 'Cash/bank account not found'; end if;

  -- The journal always posts in the company's real base currency, exactly
  -- like every other journal entry -- never the cash account's own
  -- currency, which would silently mislabel base_debit/base_credit and
  -- corrupt cross-journal aggregation (GL/TB/P&L/Balance Sheet all assume
  -- one common base currency across every posted line).
  select base_currency_id into v_company_base_currency_id from public.company_currency_settings where company_id = v_bill.company_id;
  if v_company_base_currency_id is null then raise exception 'Company base currency is not configured'; end if;

  if v_bill.currency_id = v_company_base_currency_id then
    v_rate_to_base := 1;
  else
    v_rate_to_base := public.get_exchange_rate(v_bill.currency_id, v_company_base_currency_id, p_payment_date);
    if v_rate_to_base is null then raise exception 'No exchange rate is available to convert this payment into the company base currency'; end if;
  end if;
  v_base_amount := round(p_amount * v_rate_to_base, 2);

  -- Separately, the physical bank_transactions record tracks what actually
  -- moved through the cash account, in that account's own currency.
  if v_bill.currency_id = v_cash_account.currency_id then
    v_cash_amount := p_amount;
  else
    v_rate_to_cash := public.get_exchange_rate(v_bill.currency_id, v_cash_account.currency_id, p_payment_date);
    if v_rate_to_cash is null then raise exception 'No exchange rate is available to convert this payment into the cash account currency'; end if;
    v_cash_amount := round(p_amount * v_rate_to_cash, 2);
  end if;

  insert into public.supplier_payments (
    company_id, supplier_id, supplier_bill_id, payment_date, payment_method, bank_account_id,
    currency_id, amount, exchange_rate, base_currency_id, base_currency_amount, reference
  ) values (
    v_bill.company_id, v_bill.supplier_id, v_bill.id, p_payment_date, p_payment_method, p_cash_account_id,
    v_bill.currency_id, p_amount, v_rate_to_base, v_company_base_currency_id, v_base_amount, p_reference
  ) returning id into v_payment_id;

  select id into v_ap_account from public.chart_of_accounts
    where company_id = v_bill.company_id and code = '2100' and status = 'ACTIVE';
  if v_ap_account is null then raise exception 'Accounts Payable account (2100) not found'; end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (v_bill.company_id, p_payment_date, 'supplier_payment', v_payment_id,
    'Payment for ' || v_bill.bill_number, v_company_base_currency_id, v_company_base_currency_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, supplier_id)
  values (v_je_id, 1, v_ap_account, 'Payment for ' || v_bill.bill_number, v_base_amount, 0, v_bill.supplier_id);
  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, supplier_id)
  values (v_je_id, 2, v_cash_account.gl_account_id, 'Payment for ' || v_bill.bill_number, 0, v_base_amount, v_bill.supplier_id);

  perform public.post_journal_entry(v_je_id);

  insert into public.bank_transactions (company_id, cash_account_id, transaction_date, transaction_type, direction, amount, currency_id, reference, description, reference_type, reference_id, journal_entry_id)
  values (v_bill.company_id, p_cash_account_id, p_payment_date, 'WITHDRAWAL', 'OUT', v_cash_amount, v_cash_account.currency_id, p_reference,
    'Payment for ' || v_bill.bill_number, 'supplier_payment', v_payment_id, v_je_id);

  update public.supplier_payments set journal_entry_id = v_je_id where id = v_payment_id;

  perform set_config('app.bill_status_transition', case when v_bill.paid_amount + p_amount >= v_bill.total then 'PAID' else 'PARTIALLY_PAID' end, true);
  update public.supplier_bills
  set paid_amount = paid_amount + p_amount,
      status = case when paid_amount + p_amount >= total then 'PAID' else 'PARTIALLY_PAID' end
  where id = p_supplier_bill_id;

  perform public.log_audit_event(v_bill.company_id, 'BILL_PAID', 'supplier_bill', v_bill.id,
    jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount));

  return v_payment_id;
end;
$$;
grant execute on function public.record_supplier_payment(uuid, uuid, numeric, date, text, text) to authenticated;
