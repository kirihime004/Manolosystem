-- =========================================================================
-- PHASE 5: Finance & Accounting -- Accounts Receivable logic.
-- =========================================================================
create or replace function public.before_insert_customer_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.invoice_number := public.generate_asset_code(new.company_id, 'INV');
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_customer_invoice_trigger
  before insert on public.customer_invoices
  for each row execute function public.before_insert_customer_invoice();

create or replace function public.before_update_customer_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then raise exception 'company_id cannot be changed'; end if;
  if new.invoice_number <> old.invoice_number then raise exception 'invoice_number cannot be changed'; end if;

  if new.status is distinct from old.status then
    if current_setting('app.invoice_status_transition', true) <> new.status then
      raise exception 'Use send_customer_invoice()/record_customer_payment()/cancel_customer_invoice()/void_customer_invoice() to change status';
    end if;
  end if;

  if old.status <> 'DRAFT'
     and (new.subtotal, new.tax, new.discount, new.total, new.customer_id, new.currency_id)
         is distinct from (old.subtotal, old.tax, old.discount, old.total, old.customer_id, old.currency_id) then
    raise exception 'Only draft invoices can be freely edited';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_customer_invoice_trigger
  before update on public.customer_invoices
  for each row execute function public.before_update_customer_invoice();

create or replace function public.before_write_customer_invoice_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select company_id into new.company_id from public.customer_invoices where id = new.customer_invoice_id;
  new.line_total := round(new.quantity * new.unit_price + new.tax - new.discount, 2);
  return new;
end;
$$;

create trigger before_write_customer_invoice_item_trigger
  before insert or update on public.customer_invoice_items
  for each row execute function public.before_write_customer_invoice_item();

create or replace function public.lock_customer_invoice_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.customer_invoices where id = coalesce(new.customer_invoice_id, old.customer_invoice_id);
  if v_status <> 'DRAFT' then
    raise exception 'Cannot modify items of a % invoice', v_status;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger lock_customer_invoice_items_trigger
  before insert or update or delete on public.customer_invoice_items
  for each row execute function public.lock_customer_invoice_items();

create or replace function public.after_write_customer_invoice_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_id uuid := coalesce(new.customer_invoice_id, old.customer_invoice_id);
begin
  update public.customer_invoices ci
  set subtotal = coalesce((select sum(quantity * unit_price) from public.customer_invoice_items where customer_invoice_id = v_invoice_id), 0),
      tax = coalesce((select sum(tax) from public.customer_invoice_items where customer_invoice_id = v_invoice_id), 0),
      discount = coalesce((select sum(discount) from public.customer_invoice_items where customer_invoice_id = v_invoice_id), 0),
      total = coalesce((select sum(line_total) from public.customer_invoice_items where customer_invoice_id = v_invoice_id), 0)
  where ci.id = v_invoice_id and ci.status = 'DRAFT';
  return null;
end;
$$;

create trigger after_write_customer_invoice_item_trigger
  after insert or update or delete on public.customer_invoice_items
  for each row execute function public.after_write_customer_invoice_item();

-- ---------------------------------------------------------------------
-- send_customer_invoice() -- finalizes the invoice (base-currency
-- snapshot) and posts Debit AR / Credit Revenue per line.
-- ---------------------------------------------------------------------
create or replace function public.send_customer_invoice(p_customer_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.customer_invoices%rowtype;
  v_base_currency_id uuid;
  v_rate numeric;
  v_ar_account uuid;
  v_tax_account uuid;
  v_item record;
  v_je_id uuid;
  v_line_no int := 1;
begin
  select * into v_inv from public.customer_invoices where id = p_customer_invoice_id;
  if v_inv.id is null then raise exception 'Invoice not found'; end if;
  if v_inv.status <> 'DRAFT' then raise exception 'Only draft invoices can be sent'; end if;
  if not public.has_permission(v_inv.company_id, 'FINANCE.AR.APPROVE') then
    raise exception 'Missing permission FINANCE.AR.APPROVE';
  end if;
  if v_inv.total <= 0 then raise exception 'An invoice needs at least one item before it can be sent'; end if;

  select base_currency_id into v_base_currency_id from public.company_currency_settings where company_id = v_inv.company_id;
  if v_inv.currency_id = v_base_currency_id then
    v_rate := 1;
  else
    v_rate := public.get_exchange_rate(v_inv.currency_id, v_base_currency_id, v_inv.invoice_date);
    if v_rate is null then raise exception 'No exchange rate is available to convert this invoice into the company base currency'; end if;
  end if;

  select id into v_ar_account from public.chart_of_accounts where company_id = v_inv.company_id and code = '1200' and status = 'ACTIVE';
  if v_ar_account is null then raise exception 'Accounts Receivable account (1200) not found'; end if;
  select id into v_tax_account from public.chart_of_accounts where company_id = v_inv.company_id and code = '2200' and status = 'ACTIVE';
  if v_tax_account is null then raise exception 'Taxes Payable account (2200) not found'; end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (v_inv.company_id, v_inv.invoice_date, 'customer_invoice', v_inv.id,
    'Customer invoice ' || v_inv.invoice_number, v_inv.currency_id, v_base_currency_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, department_id, cost_center_id, profit_center_id, customer_id)
  values (v_je_id, v_line_no, v_ar_account, 'Invoice ' || v_inv.invoice_number, v_inv.total, 0, v_inv.department_id, v_inv.cost_center_id, v_inv.profit_center_id, v_inv.customer_id);

  -- Revenue accounts are credited net of tax, with tax split into its own
  -- line, so the revenue account isn't overstated by the tax amount (the
  -- same fix applied to decide_supplier_bill_approval() for input tax).
  for v_item in select * from public.customer_invoice_items where customer_invoice_id = v_inv.id order by created_at loop
    v_line_no := v_line_no + 1;
    insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, project_id, customer_id)
    values (v_je_id, v_line_no, coalesce(v_item.revenue_account_id, public.get_account_by_code(v_inv.company_id, '4300')),
      v_item.description, 0, v_item.line_total - v_item.tax, v_item.project_id, v_inv.customer_id);
    if v_item.tax > 0 then
      v_line_no := v_line_no + 1;
      insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, customer_id)
      values (v_je_id, v_line_no, v_tax_account, 'Output tax: ' || v_item.description, 0, v_item.tax, v_inv.customer_id);
    end if;
  end loop;

  perform public.post_journal_entry(v_je_id);

  perform set_config('app.invoice_status_transition', 'SENT', true);
  update public.customer_invoices set
    status = 'SENT', base_currency_id = v_base_currency_id, exchange_rate = v_rate,
    base_currency_total = round(total * v_rate, 2), journal_entry_id = v_je_id
  where id = p_customer_invoice_id;

  perform public.log_audit_event(v_inv.company_id, 'INVOICE_SENT', 'customer_invoice', v_inv.id,
    jsonb_build_object('invoice_number', v_inv.invoice_number, 'total', v_inv.total));
end;
$$;
grant execute on function public.send_customer_invoice(uuid) to authenticated;

create or replace function public.cancel_customer_invoice(p_customer_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.customer_invoices%rowtype;
begin
  select * into v_inv from public.customer_invoices where id = p_customer_invoice_id;
  if v_inv.id is null then raise exception 'Invoice not found'; end if;
  if v_inv.status <> 'DRAFT' then raise exception 'Only draft invoices can be cancelled -- use void_customer_invoice() for sent ones'; end if;
  if not public.has_permission(v_inv.company_id, 'FINANCE.AR.CREATE') then
    raise exception 'Missing permission FINANCE.AR.CREATE';
  end if;
  perform set_config('app.invoice_status_transition', 'CANCELLED', true);
  update public.customer_invoices set status = 'CANCELLED' where id = p_customer_invoice_id;
end;
$$;
grant execute on function public.cancel_customer_invoice(uuid) to authenticated;

create or replace function public.void_customer_invoice(p_customer_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.customer_invoices%rowtype;
begin
  select * into v_inv from public.customer_invoices where id = p_customer_invoice_id;
  if v_inv.id is null then raise exception 'Invoice not found'; end if;
  if v_inv.status not in ('SENT', 'OVERDUE') then raise exception 'Only a sent, unpaid invoice can be voided'; end if;
  if v_inv.paid_amount > 0 then raise exception 'Cannot void an invoice that already has payments applied'; end if;
  if not public.has_permission(v_inv.company_id, 'FINANCE.AR.APPROVE') then
    raise exception 'Missing permission FINANCE.AR.APPROVE';
  end if;

  if v_inv.journal_entry_id is not null then
    perform public.reverse_journal_entry(v_inv.journal_entry_id, coalesce(p_reason, 'Invoice voided'));
  end if;

  perform set_config('app.invoice_status_transition', 'VOID', true);
  update public.customer_invoices set status = 'VOID', notes = coalesce(notes || E'\n', '') || 'Voided: ' || coalesce(p_reason, '') where id = p_customer_invoice_id;
end;
$$;
grant execute on function public.void_customer_invoice(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- record_customer_payment() -- overpayment is allowed (flagged, not
-- blocked): the opposite policy from AP, per spec section 30.
-- ---------------------------------------------------------------------
create or replace function public.record_customer_payment(
  p_customer_invoice_id uuid,
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
  v_inv public.customer_invoices%rowtype;
  v_cash_account public.cash_accounts%rowtype;
  v_company_base_currency_id uuid;
  v_ar_account uuid;
  v_outstanding numeric;
  v_is_overpayment boolean;
  v_payment_id uuid;
  v_je_id uuid;
  v_rate_to_base numeric;
  v_base_amount numeric;
  v_rate_to_cash numeric;
  v_cash_amount numeric;
begin
  select * into v_inv from public.customer_invoices where id = p_customer_invoice_id;
  if v_inv.id is null then raise exception 'Invoice not found'; end if;
  if v_inv.status not in ('SENT', 'PARTIALLY_PAID', 'OVERDUE') then
    raise exception 'Only a sent invoice can receive payments';
  end if;
  if not public.has_permission(v_inv.company_id, 'FINANCE.AR.RECEIVE_PAYMENT') then
    raise exception 'Missing permission FINANCE.AR.RECEIVE_PAYMENT';
  end if;
  if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  v_outstanding := v_inv.total - v_inv.paid_amount;
  v_is_overpayment := p_amount > v_outstanding;

  select * into v_cash_account from public.cash_accounts where id = p_cash_account_id and company_id = v_inv.company_id;
  if v_cash_account.id is null then raise exception 'Cash/bank account not found'; end if;

  -- Same fix as record_supplier_payment(): the journal always posts in the
  -- company's real base currency, never the cash account's own currency.
  select base_currency_id into v_company_base_currency_id from public.company_currency_settings where company_id = v_inv.company_id;
  if v_company_base_currency_id is null then raise exception 'Company base currency is not configured'; end if;

  if v_inv.currency_id = v_company_base_currency_id then
    v_rate_to_base := 1;
  else
    v_rate_to_base := public.get_exchange_rate(v_inv.currency_id, v_company_base_currency_id, p_payment_date);
    if v_rate_to_base is null then raise exception 'No exchange rate is available to convert this payment into the company base currency'; end if;
  end if;
  v_base_amount := round(p_amount * v_rate_to_base, 2);

  if v_inv.currency_id = v_cash_account.currency_id then
    v_cash_amount := p_amount;
  else
    v_rate_to_cash := public.get_exchange_rate(v_inv.currency_id, v_cash_account.currency_id, p_payment_date);
    if v_rate_to_cash is null then raise exception 'No exchange rate is available to convert this payment into the cash account currency'; end if;
    v_cash_amount := round(p_amount * v_rate_to_cash, 2);
  end if;

  insert into public.customer_payments (
    company_id, customer_id, customer_invoice_id, payment_date, payment_method, bank_account_id,
    currency_id, amount, exchange_rate, base_currency_id, base_currency_amount, is_overpayment, reference
  ) values (
    v_inv.company_id, v_inv.customer_id, v_inv.id, p_payment_date, p_payment_method, p_cash_account_id,
    v_inv.currency_id, p_amount, v_rate_to_base, v_company_base_currency_id, v_base_amount, v_is_overpayment, p_reference
  ) returning id into v_payment_id;

  select id into v_ar_account from public.chart_of_accounts where company_id = v_inv.company_id and code = '1200' and status = 'ACTIVE';
  if v_ar_account is null then raise exception 'Accounts Receivable account (1200) not found'; end if;

  insert into public.journal_entries (company_id, date, reference_type, reference_id, description, currency_id, base_currency_id)
  values (v_inv.company_id, p_payment_date, 'customer_payment', v_payment_id,
    'Payment received for ' || v_inv.invoice_number, v_company_base_currency_id, v_company_base_currency_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, customer_id)
  values (v_je_id, 1, v_cash_account.gl_account_id, 'Payment for ' || v_inv.invoice_number, v_base_amount, 0, v_inv.customer_id);
  insert into public.journal_entry_lines (journal_entry_id, line_number, account_id, description, debit, credit, customer_id)
  values (v_je_id, 2, v_ar_account, 'Payment for ' || v_inv.invoice_number, 0, v_base_amount, v_inv.customer_id);

  perform public.post_journal_entry(v_je_id);

  insert into public.bank_transactions (company_id, cash_account_id, transaction_date, transaction_type, direction, amount, currency_id, reference, description, reference_type, reference_id, journal_entry_id)
  values (v_inv.company_id, p_cash_account_id, p_payment_date, 'DEPOSIT', 'IN', v_cash_amount, v_cash_account.currency_id, p_reference,
    'Payment received for ' || v_inv.invoice_number, 'customer_payment', v_payment_id, v_je_id);

  update public.customer_payments set journal_entry_id = v_je_id where id = v_payment_id;

  perform set_config('app.invoice_status_transition', case when v_inv.paid_amount + p_amount >= v_inv.total then 'PAID' else 'PARTIALLY_PAID' end, true);
  update public.customer_invoices
  set paid_amount = paid_amount + p_amount,
      status = case when paid_amount + p_amount >= total then 'PAID' else 'PARTIALLY_PAID' end
  where id = p_customer_invoice_id;

  perform public.log_audit_event(v_inv.company_id, 'INVOICE_PAID', 'customer_invoice', v_inv.id,
    jsonb_build_object('payment_id', v_payment_id, 'amount', p_amount, 'is_overpayment', v_is_overpayment));

  return v_payment_id;
end;
$$;
grant execute on function public.record_customer_payment(uuid, uuid, numeric, date, text, text) to authenticated;
