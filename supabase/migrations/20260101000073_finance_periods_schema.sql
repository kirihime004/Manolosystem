-- =========================================================================
-- PHASE 5: Finance & Accounting -- fiscal years and financial periods.
-- Fiscal years are NOT auto-seeded on company creation (unlike lookup
-- tables such as budget_categories): a company's fiscal calendar is a real
-- business decision made once during Finance setup, with no universally
-- correct default beyond the calendar-year suggestion Finance Settings
-- offers. generate_financial_periods() is what actually populates a
-- fiscal year with monthly/quarterly/yearly periods once created.
-- =========================================================================
create table public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'CLOSED')),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  check (end_date > start_date)
);
create index fiscal_years_company_idx on public.fiscal_years (company_id, start_date desc);
create trigger set_fiscal_years_updated_at before update on public.fiscal_years
  for each row execute function public.set_updated_at();
alter table public.fiscal_years enable row level security;

create or replace function public.enforce_single_current_fiscal_year()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_current then
    update public.fiscal_years
    set is_current = false
    where company_id = new.company_id and id <> new.id and is_current;
  end if;
  return new;
end;
$$;

create trigger enforce_single_current_fiscal_year_trigger
  before insert or update of is_current on public.fiscal_years
  for each row when (new.is_current)
  execute function public.enforce_single_current_fiscal_year();

-- ---------------------------------------------------------------------
-- financial_periods
-- ---------------------------------------------------------------------
create table public.financial_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  fiscal_year_id uuid not null references public.fiscal_years(id) on delete cascade,
  name text not null,
  period_type text not null check (period_type in ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  start_date date not null,
  end_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED', 'LOCKED')),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  check (end_date > start_date)
);
create index financial_periods_company_idx on public.financial_periods (company_id, start_date desc);
create index financial_periods_fiscal_year_idx on public.financial_periods (fiscal_year_id);
create trigger set_financial_periods_updated_at before update on public.financial_periods
  for each row execute function public.set_updated_at();
alter table public.financial_periods enable row level security;

-- Finds the OPEN period covering a given date, if any. Used by the journal
-- engine to reject postings into a period that's CLOSED/LOCKED or has no
-- period defined at all.
create or replace function public.get_open_period(p_company_id uuid, p_date date)
returns public.financial_periods
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select fp.* from public.financial_periods fp
  where fp.company_id = p_company_id
    and fp.start_date <= p_date and fp.end_date >= p_date
    and fp.status = 'OPEN'
  limit 1;
$$;
grant execute on function public.get_open_period(uuid, date) to authenticated;

-- Generates non-overlapping periods spanning a fiscal year's date range.
-- Rejects if periods already exist for this fiscal year (call again after
-- deleting them, rather than silently duplicating).
create or replace function public.generate_financial_periods(
  p_fiscal_year_id uuid,
  p_period_type text
) returns setof public.financial_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fy public.fiscal_years;
  v_cursor date;
  v_period_end date;
  v_name text;
begin
  select * into v_fy from public.fiscal_years where id = p_fiscal_year_id;
  if v_fy is null then
    raise exception 'Fiscal year not found';
  end if;
  if not public.has_permission(v_fy.company_id, 'FINANCE.SETTINGS.MANAGE') then
    raise exception 'Not authorized to generate financial periods';
  end if;
  if p_period_type not in ('MONTHLY', 'QUARTERLY', 'YEARLY') then
    raise exception 'Invalid period type: %', p_period_type;
  end if;
  if exists (select 1 from public.financial_periods where fiscal_year_id = p_fiscal_year_id) then
    raise exception 'Periods already exist for this fiscal year';
  end if;

  v_cursor := v_fy.start_date;
  while v_cursor <= v_fy.end_date loop
    v_period_end := case p_period_type
      when 'MONTHLY' then least((v_cursor + interval '1 month' - interval '1 day')::date, v_fy.end_date)
      when 'QUARTERLY' then least((v_cursor + interval '3 months' - interval '1 day')::date, v_fy.end_date)
      else v_fy.end_date
    end;
    v_name := case p_period_type
      when 'MONTHLY' then to_char(v_cursor, 'FMMonth YYYY')
      when 'QUARTERLY' then 'Q' || to_char(v_cursor, 'Q') || ' ' || to_char(v_cursor, 'YYYY')
      else v_fy.name
    end;

    return query
      insert into public.financial_periods (company_id, fiscal_year_id, name, period_type, start_date, end_date)
      values (v_fy.company_id, v_fy.id, v_name, p_period_type, v_cursor, v_period_end)
      returning *;

    v_cursor := v_period_end + 1;
  end loop;
end;
$$;
grant execute on function public.generate_financial_periods(uuid, text) to authenticated;
