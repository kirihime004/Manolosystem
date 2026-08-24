-- =========================================================================
-- PHASE 5: Finance & Accounting -- Tax logic. Rather than re-defining the
-- large decide_supplier_bill_approval()/send_customer_invoice() functions
-- just to append a tax_transactions insert, this hooks in as separate
-- AFTER UPDATE triggers keyed on the status transition -- lower risk than
-- re-pasting those bodies, and keeps tax-posting logic in one file.
-- =========================================================================
create or replace function public.after_supplier_bill_approved_post_tax()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'APPROVED' and old.status is distinct from 'APPROVED' and new.tax > 0 then
    insert into public.tax_transactions (
      company_id, reference_type, reference_id, tax_type, direction, supplier_id,
      transaction_date, base_amount, tax_amount, currency_id, base_currency_id, base_currency_tax_amount
    ) values (
      new.company_id, 'supplier_bill', new.id, 'VAT', 'INPUT', new.supplier_id,
      new.bill_date, new.subtotal, new.tax, new.currency_id, new.base_currency_id,
      round(new.tax * coalesce(new.exchange_rate, 1), 2)
    );
  end if;
  return new;
end;
$$;

create trigger after_supplier_bill_approved_post_tax_trigger
  after update on public.supplier_bills
  for each row execute function public.after_supplier_bill_approved_post_tax();

create or replace function public.after_customer_invoice_sent_post_tax()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'SENT' and old.status is distinct from 'SENT' and new.tax > 0 then
    insert into public.tax_transactions (
      company_id, reference_type, reference_id, tax_type, direction, customer_id,
      transaction_date, base_amount, tax_amount, currency_id, base_currency_id, base_currency_tax_amount
    ) values (
      new.company_id, 'customer_invoice', new.id, 'VAT', 'OUTPUT', new.customer_id,
      new.invoice_date, new.subtotal, new.tax, new.currency_id, new.base_currency_id,
      round(new.tax * coalesce(new.exchange_rate, 1), 2)
    );
  end if;
  return new;
end;
$$;

create trigger after_customer_invoice_sent_post_tax_trigger
  after update on public.customer_invoices
  for each row execute function public.after_customer_invoice_sent_post_tax();

-- ---------------------------------------------------------------------
-- Tax Summary report (spec section 44): output tax, input tax, net
-- payable, per tax type, for a date range.
-- ---------------------------------------------------------------------
create or replace function public.get_tax_summary(p_company_id uuid, p_start_date date, p_end_date date)
returns table (
  tax_type text, direction text, base_amount numeric, tax_amount numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
  select tax_type, direction, sum(base_amount), sum(coalesce(base_currency_tax_amount, tax_amount))
  from public.tax_transactions
  where company_id = p_company_id and transaction_date between p_start_date and p_end_date
  group by tax_type, direction
  order by tax_type, direction;
$$;
grant execute on function public.get_tax_summary(uuid, date, date) to authenticated;
