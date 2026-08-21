-- Global permission catalog. Keys follow MODULE.RESOURCE.ACTION, e.g. IT.TICKETS.VIEW.
-- This table is platform-managed (seeded by migration), not company-scoped.
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  module_key public.module_key not null,
  resource text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.permissions enable row level security;

-- Roles are always owned by a single company. Each company gets its own copy
-- of the default roles (seeded on company creation) plus any custom roles it
-- creates later; this keeps every RLS policy a simple company_id scope.
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create trigger set_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

alter table public.roles enable row level security;

-- System (default) roles cannot be deleted or renamed out from under the
-- seed data, but their permission assignments can still be edited.
create or replace function public.protect_system_roles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'System roles cannot be deleted';
    end if;
    return old;
  end if;

  if old.is_system and new.name <> old.name then
    raise exception 'System roles cannot be renamed';
  end if;
  if old.is_system and new.is_system is distinct from true then
    raise exception 'System roles cannot lose their system flag';
  end if;
  return new;
end;
$$;

create trigger protect_system_roles_trigger
  before update or delete on public.roles
  for each row execute function public.protect_system_roles();

-- role_permissions / user_roles carry a denormalized company_id so RLS
-- policies never need a join. Both are derived server-side (never trusted
-- from the client) so they can never drift from their parent row.
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create or replace function public.derive_role_permissions_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select r.company_id into new.company_id from public.roles r where r.id = new.role_id;
  if new.company_id is null then
    raise exception 'Invalid role_id';
  end if;
  return new;
end;
$$;

create trigger derive_role_permissions_company_id_trigger
  before insert or update on public.role_permissions
  for each row execute function public.derive_role_permissions_company_id();

alter table public.role_permissions enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  company_user_id uuid not null references public.company_users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (company_user_id, role_id)
);

create index user_roles_company_user_id_idx on public.user_roles (company_user_id);

create or replace function public.derive_user_roles_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_membership_company_id uuid;
  v_role_company_id uuid;
begin
  select cu.company_id into v_membership_company_id
    from public.company_users cu where cu.id = new.company_user_id;
  select r.company_id into v_role_company_id
    from public.roles r where r.id = new.role_id;

  if v_membership_company_id is null then
    raise exception 'Invalid company_user_id';
  end if;
  if v_role_company_id is null then
    raise exception 'Invalid role_id';
  end if;
  if v_membership_company_id <> v_role_company_id then
    raise exception 'Role does not belong to the same company as the membership';
  end if;

  new.company_id := v_membership_company_id;
  return new;
end;
$$;

create trigger derive_user_roles_company_id_trigger
  before insert or update on public.user_roles
  for each row execute function public.derive_user_roles_company_id();

alter table public.user_roles enable row level security;
