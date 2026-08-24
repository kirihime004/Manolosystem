-- =========================================================================
-- Fix: supplier_payments.payment_number and customer_payments.payment_number
-- are NOT NULL, but no before-insert trigger was ever wired to populate
-- them (every other numbered table in this phase -- journal_entries,
-- supplier_bills, customer_invoices, expenses -- has one; these two were
-- missed). Caught by live-testing record_supplier_payment(), which failed
-- with a not-null constraint violation on insert.
-- =========================================================================
create or replace function public.before_insert_supplier_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.payment_number := public.generate_asset_code(new.company_id, 'PAY');
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_supplier_payment_trigger
  before insert on public.supplier_payments
  for each row execute function public.before_insert_supplier_payment();

create or replace function public.before_insert_customer_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.payment_number := public.generate_asset_code(new.company_id, 'RCPT');
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_customer_payment_trigger
  before insert on public.customer_payments
  for each row execute function public.before_insert_customer_payment();
