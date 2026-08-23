-- =========================================================================
-- PHASE 4: Compensation history. Never overwritten -- a new effective-dated
-- row is inserted on every change (raise, currency change, pay-type
-- change); the "current" salary is just the latest row by effective_date.
-- Sensitive: RLS (063) requires HR.EMPLOYEES.VIEW_SALARY to read this
-- table at all, regardless of general HR.EMPLOYEES.VIEW access.
-- =========================================================================
create table public.employee_compensation (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  effective_date date not null,
  pay_type text not null check (pay_type in ('MONTHLY', 'BIWEEKLY', 'WEEKLY', 'DAILY', 'HOURLY', 'PROJECT_BASED')),
  basic_salary numeric(14, 2) not null check (basic_salary >= 0),
  currency_id uuid not null references public.currencies(id),
  pay_frequency text,
  allowance numeric(14, 2) default 0 check (allowance >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employee_compensation_employee_idx on public.employee_compensation (employee_id, effective_date desc);
create trigger set_employee_compensation_updated_at before update on public.employee_compensation
  for each row execute function public.set_updated_at();
alter table public.employee_compensation enable row level security;

-- Compensation rows are immutable once written -- corrections are a new
-- row, per the spec's "salary history must be preserved" requirement.
create or replace function public.protect_compensation_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'Compensation history cannot be modified or deleted; insert a new effective-dated row instead';
end;
$$;

create trigger protect_compensation_history_trigger
  before update or delete on public.employee_compensation
  for each row execute function public.protect_compensation_history();

create or replace function public.before_insert_employee_compensation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger before_insert_employee_compensation_trigger
  before insert on public.employee_compensation
  for each row execute function public.before_insert_employee_compensation();

create or replace function public.after_insert_employee_compensation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_employee_event(new.company_id, new.employee_id, 'SALARY_CHANGED', 'basic_salary', null, new.basic_salary::text, null,
    'Effective ' || new.effective_date::text);
  perform public.log_audit_event(new.company_id, 'COMPENSATION_RECORDED', 'employee', new.employee_id,
    jsonb_build_object('effective_date', new.effective_date));
  return new;
end;
$$;

create trigger after_insert_employee_compensation_trigger
  after insert on public.employee_compensation
  for each row execute function public.after_insert_employee_compensation();

-- Convenience view: each employee's current (latest effective-dated) row.
create or replace view public.v_current_compensation
with (security_invoker = true) as
select distinct on (employee_id) *
from public.employee_compensation
order by employee_id, effective_date desc, created_at desc;
