-- =========================================================================
-- PHASE 4: Payroll periods -- preparation only. Full payroll calculation
-- and accounting belongs to the future Finance phase; this table just
-- gives HR a place to define pay periods and mark their preparation
-- status ahead of that integration.
-- =========================================================================
create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_name text not null,
  frequency text not null check (frequency in ('MONTHLY', 'BIWEEKLY', 'WEEKLY')),
  start_date date not null,
  end_date date not null,
  pay_date date,
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'OPEN', 'PROCESSING', 'REVIEW', 'APPROVED', 'PAID', 'CLOSED'
  )),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index payroll_periods_company_idx on public.payroll_periods (company_id, start_date desc);
create trigger set_payroll_periods_updated_at before update on public.payroll_periods
  for each row execute function public.set_updated_at();
alter table public.payroll_periods enable row level security;

create or replace function public.before_insert_payroll_period()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger before_insert_payroll_period_trigger
  before insert on public.payroll_periods
  for each row execute function public.before_insert_payroll_period();
