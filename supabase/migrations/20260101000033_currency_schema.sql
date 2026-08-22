-- =========================================================================
-- PHASE 3: Currency architecture
-- =========================================================================
-- `currencies` is a global, platform-managed catalog (same pattern as
-- `permissions`) -- never duplicated per company. `company_currency_settings`
-- picks one as a company's base/reporting currency. `exchange_rates` is also
-- global/shared market data (one USD->PHP rate benefits every tenant that
-- needs it) and is strictly append-only: a new effective-dated row is how a
-- rate "changes", nothing is ever overwritten, so a transaction that
-- snapshotted a historical rate can never drift.

create table public.currencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  symbol text not null,
  decimal_places smallint not null default 2,
  country_or_region text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.currencies
  add constraint currencies_code_format check (code ~ '^[A-Z]{3}$');

create trigger set_currencies_updated_at before update on public.currencies
  for each row execute function public.set_updated_at();
alter table public.currencies enable row level security;

insert into public.currencies (code, name, symbol, decimal_places, country_or_region) values
  ('PHP', 'Philippine Peso', '₱', 2, 'Philippines'),
  ('USD', 'US Dollar', '$', 2, 'United States'),
  ('AUD', 'Australian Dollar', '$', 2, 'Australia'),
  ('EUR', 'Euro', '€', 2, 'European Union'),
  ('GBP', 'British Pound', '£', 2, 'United Kingdom'),
  ('PGK', 'Papua New Guinean Kina', 'K', 2, 'Papua New Guinea'),
  ('JPY', 'Japanese Yen', '¥', 0, 'Japan'),
  ('NZD', 'New Zealand Dollar', '$', 2, 'New Zealand'),
  ('SGD', 'Singapore Dollar', '$', 2, 'Singapore'),
  ('CAD', 'Canadian Dollar', '$', 2, 'Canada'),
  ('CNY', 'Chinese Yuan', '¥', 2, 'China');

-- ---------------------------------------------------------------------
-- Per-company base currency. Defaults to PHP on every new company; a
-- Company Admin with IT.CURRENCY.MANAGE can change it later. Changing it
-- only affects the DEFAULT for new budgets/reports going forward --
-- finalized transactions keep their own recorded currency + rate
-- (see purchase_orders.exchange_rate etc.), never recalculated.
-- ---------------------------------------------------------------------
create table public.company_currency_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  base_currency_id uuid not null references public.currencies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_company_currency_settings_updated_at before update on public.company_currency_settings
  for each row execute function public.set_updated_at();
alter table public.company_currency_settings enable row level security;

create or replace function public.seed_company_currency_settings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_php_id uuid;
begin
  select id into v_php_id from public.currencies where code = 'PHP';
  insert into public.company_currency_settings (company_id, base_currency_id)
  values (new.id, v_php_id);
  return new;
end;
$$;

create trigger seed_company_currency_settings_trigger
  after insert on public.companies
  for each row execute function public.seed_company_currency_settings();

-- Backfill for companies created before this migration (Toon City etc).
insert into public.company_currency_settings (company_id, base_currency_id)
select c.id, (select id from public.currencies where code = 'PHP')
from public.companies c
on conflict (company_id) do nothing;

-- ---------------------------------------------------------------------
-- Exchange rates: global, append-only history. `rate` converts 1 unit of
-- from_currency into to_currency. Only is_active/source/notes may ever be
-- updated after creation -- the financial fields (rate, currencies,
-- effective_date) are immutable once inserted, enforced below.
-- ---------------------------------------------------------------------
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency_id uuid not null references public.currencies(id),
  to_currency_id uuid not null references public.currencies(id),
  rate numeric(18, 6) not null check (rate > 0),
  effective_date date not null default current_date,
  source text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_currency_id <> to_currency_id)
);

create index exchange_rates_lookup_idx on public.exchange_rates (from_currency_id, to_currency_id, effective_date desc);
create trigger set_exchange_rates_updated_at before update on public.exchange_rates
  for each row execute function public.set_updated_at();
alter table public.exchange_rates enable row level security;

create or replace function public.protect_exchange_rate_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.rate, new.from_currency_id, new.to_currency_id, new.effective_date)
     is distinct from (old.rate, old.from_currency_id, old.to_currency_id, old.effective_date) then
    raise exception 'Historical exchange rate values cannot be modified -- insert a new rate instead';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_exchange_rate_history_trigger
  before update on public.exchange_rates
  for each row execute function public.protect_exchange_rate_history();

-- Looks up the most recent active rate effective on or before p_on_date
-- (defaults to today). Used for real-time conversions/estimates -- actual
-- procurement transactions snapshot their own rate at finalization time
-- rather than calling this repeatedly, so they never drift.
create or replace function public.get_exchange_rate(
  p_from_currency_id uuid,
  p_to_currency_id uuid,
  p_on_date date default current_date
)
returns numeric
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select case when p_from_currency_id = p_to_currency_id then 1
    else (
      select rate from public.exchange_rates
      where from_currency_id = p_from_currency_id
        and to_currency_id = p_to_currency_id
        and is_active
        and effective_date <= p_on_date
      order by effective_date desc
      limit 1
    )
  end;
$$;

grant execute on function public.get_exchange_rate(uuid, uuid, date) to authenticated;

-- Whether the caller holds a given permission key in ANY company they
-- belong to (not scoped to one company_id). Needed for genuinely global
-- resources like exchange rates, where "which company are you acting as"
-- doesn't apply to the row being written.
create or replace function public.has_any_permission(p_permission_key text)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    public.is_platform_superadmin()
    or exists (
      select 1
      from public.company_users cu
      join public.user_roles ur on ur.company_user_id = cu.id
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where cu.user_id = auth.uid()
        and cu.status = 'ACTIVE'
        and p.key = p_permission_key
    );
$$;

grant execute on function public.has_any_permission(text) to authenticated;
