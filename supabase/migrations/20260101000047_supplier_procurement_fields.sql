-- Extend the existing Phase 2 suppliers table (reused, not duplicated)
-- with the fields Phase 3 procurement needs: tax/business number, payment
-- terms, a preferred currency, and a status lifecycle.
alter table public.suppliers add column tax_number text;
alter table public.suppliers add column payment_terms text;
alter table public.suppliers add column currency_id uuid references public.currencies(id);
alter table public.suppliers add column status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'BLACKLISTED'));
