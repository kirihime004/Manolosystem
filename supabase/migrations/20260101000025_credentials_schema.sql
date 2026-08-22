-- =========================================================================
-- PHASE 2: Credential / password inventory
-- =========================================================================
-- Deliberately NOT part of `assets` -- credentials need a stricter access
-- model (separate REVEAL permission, audited reveals, encrypted-at-rest
-- secret) than an ordinary hardware/software record. The secret itself is
-- never stored in plaintext: encrypted_secret/secret_iv hold AES-GCM
-- ciphertext produced by the credential-set-secret Edge Function using a
-- server-only key (CREDENTIAL_ENCRYPTION_KEY), and only credential-reveal
-- (also server-side) can decrypt it. Postgres itself never sees the
-- plaintext or the key.
create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  credential_code text not null,
  credential_name text not null,
  system text not null,
  url text,
  username text,
  encrypted_secret text,
  secret_iv text,
  category text not null default 'OTHER' check (category in (
    'NETWORK', 'SERVER', 'EMAIL', 'CLOUD', 'SOFTWARE', 'DATABASE', 'DOMAIN', 'PRINTER', 'SECURITY', 'OTHER'
  )),
  assigned_owner uuid references auth.users(id) on delete set null,
  notes text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'RETIRED')),
  last_rotated date,
  next_rotation date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, credential_code)
);

create index credentials_company_id_idx on public.credentials (company_id, credential_name);
create trigger set_credentials_updated_at before update on public.credentials
  for each row execute function public.set_updated_at();
alter table public.credentials enable row level security;

create or replace function public.before_insert_credential()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.credential_code := public.generate_asset_code(new.company_id, 'CR');
  new.created_by := auth.uid();
  return new;
end;
$$;

create trigger before_insert_credential_trigger
  before insert on public.credentials
  for each row execute function public.before_insert_credential();

create or replace function public.after_insert_credential()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_audit_event(new.company_id, 'CREDENTIAL_CREATED', 'credential', new.id,
    jsonb_build_object('credential_code', new.credential_code, 'system', new.system));
  return new;
end;
$$;

create trigger after_insert_credential_trigger
  after insert on public.credentials
  for each row execute function public.after_insert_credential();

create or replace function public.after_update_credential()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.encrypted_secret is distinct from old.encrypted_secret then
    perform public.log_audit_event(new.company_id, 'CREDENTIAL_SECRET_UPDATED', 'credential', new.id,
      jsonb_build_object('system', new.system));
  elsif (new.credential_name, new.system, new.url, new.username, new.category, new.assigned_owner, new.status)
        is distinct from
        (old.credential_name, old.system, old.url, old.username, old.category, old.assigned_owner, old.status) then
    perform public.log_audit_event(new.company_id, 'CREDENTIAL_UPDATED', 'credential', new.id,
      jsonb_build_object('system', new.system));
  end if;
  return new;
end;
$$;

create trigger after_update_credential_trigger
  after update on public.credentials
  for each row execute function public.after_update_credential();

-- The client (even with IT.CREDENTIALS.UPDATE) can freely edit ordinary
-- fields, but encrypted_secret/secret_iv may only be written by the
-- credential-set-secret Edge Function, which authenticates with the
-- service role. auth.role() reflects the JWT that signed the request, so
-- this reliably tells a normal authenticated session apart from the
-- service-role client -- it's what stops the encryption step from being
-- bypassed by a direct table write of unencrypted text.
create or replace function public.protect_credential_secret_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' and (new.encrypted_secret is not null or new.secret_iv is not null) then
      raise exception 'encrypted_secret can only be set via the credential-set-secret function';
    end if;
    if tg_op = 'UPDATE' and (new.encrypted_secret, new.secret_iv) is distinct from (old.encrypted_secret, old.secret_iv) then
      raise exception 'encrypted_secret can only be set via the credential-set-secret function';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_credential_secret_columns_trigger
  before insert or update on public.credentials
  for each row execute function public.protect_credential_secret_columns();
