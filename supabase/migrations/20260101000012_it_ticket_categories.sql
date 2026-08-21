create table public.ticket_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create trigger set_ticket_categories_updated_at
  before update on public.ticket_categories
  for each row execute function public.set_updated_at();

alter table public.ticket_categories enable row level security;

create table public.ticket_subcategories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.ticket_categories(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create trigger set_ticket_subcategories_updated_at
  before update on public.ticket_subcategories
  for each row execute function public.set_updated_at();

alter table public.ticket_subcategories enable row level security;

create or replace function public.derive_ticket_subcategory_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select c.company_id into new.company_id from public.ticket_categories c where c.id = new.category_id;
  if new.company_id is null then
    raise exception 'Invalid category_id';
  end if;
  return new;
end;
$$;

create trigger derive_ticket_subcategory_company_id_trigger
  before insert or update on public.ticket_subcategories
  for each row execute function public.derive_ticket_subcategory_company_id();

create policy "ticket_categories_select_members" on public.ticket_categories
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'IT'));

create policy "ticket_categories_write_admin" on public.ticket_categories
  for all
  using (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'IT'))
  )
  with check (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'IT'))
  );

create policy "ticket_subcategories_select_members" on public.ticket_subcategories
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'IT'));

create policy "ticket_subcategories_write_admin" on public.ticket_subcategories
  for all
  using (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'IT'))
  )
  with check (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'IT'))
  );

-- Seed the default category/subcategory tree whenever a company is created.
create or replace function public.seed_company_it_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hardware uuid;
  v_software uuid;
  v_network uuid;
  v_account uuid;
  v_other uuid;
begin
  insert into public.ticket_categories (company_id, name) values (new.id, 'Hardware') returning id into v_hardware;
  insert into public.ticket_categories (company_id, name) values (new.id, 'Software') returning id into v_software;
  insert into public.ticket_categories (company_id, name) values (new.id, 'Network') returning id into v_network;
  insert into public.ticket_categories (company_id, name) values (new.id, 'Account') returning id into v_account;
  insert into public.ticket_categories (company_id, name) values (new.id, 'Other') returning id into v_other;

  insert into public.ticket_subcategories (company_id, category_id, name)
  select new.id, v_hardware, x.name from (values
    ('Desktop'), ('Laptop'), ('Monitor'), ('Printer'), ('Scanner'),
    ('Keyboard'), ('Mouse'), ('UPS'), ('Network Device'), ('Server')
  ) as x(name);

  insert into public.ticket_subcategories (company_id, category_id, name)
  select new.id, v_software, x.name from (values
    ('Windows'), ('Microsoft Office'), ('Outlook'), ('Adobe'), ('MYOB'),
    ('Autodesk'), ('Other Software')
  ) as x(name);

  insert into public.ticket_subcategories (company_id, category_id, name)
  select new.id, v_network, x.name from (values
    ('Internet'), ('Wi-Fi'), ('LAN'), ('VPN'), ('Firewall'), ('DNS'), ('Email')
  ) as x(name);

  insert into public.ticket_subcategories (company_id, category_id, name)
  select new.id, v_account, x.name from (values
    ('Password Reset'), ('New Account'), ('Access Request'),
    ('Permission Request'), ('Email Account'), ('System Access')
  ) as x(name);

  insert into public.ticket_subcategories (company_id, category_id, name)
  select new.id, v_other, x.name from (values
    ('General IT'), ('Security'), ('Other')
  ) as x(name);

  return new;
end;
$$;

create trigger seed_company_it_categories_trigger
  after insert on public.companies
  for each row execute function public.seed_company_it_categories();
