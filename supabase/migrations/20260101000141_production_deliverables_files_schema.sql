-- =========================================================================
-- PHASE 7: Deliverables + private production file storage. Follows the
-- exact bucket-path/RLS convention every prior phase's private storage
-- used (admin-documents in Phase 6, etc): {company_id}/{resource_type}/
-- {resource_id}/{filename}, public=false, reads only via signed URL.
-- =========================================================================

create table public.production_deliverables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.production_projects(id) on delete cascade,
  episode_id uuid references public.production_episodes(id) on delete set null,
  shot_id uuid references public.production_shots(id) on delete set null,
  deliverable_code text not null,
  name text not null,
  description text,
  version_id uuid references public.production_versions(id) on delete set null,
  recipient_client_id uuid references public.customers(id) on delete set null,
  due_date date,
  delivered_date date,
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'REJECTED')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, deliverable_code)
);

create index idx_production_deliverables_project on public.production_deliverables(project_id);

alter table public.production_deliverables enable row level security;

create policy "production_deliverables_select" on public.production_deliverables
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_DELIVERABLES') and public.has_permission(company_id, 'PRODUCTION.DELIVERABLES.VIEW'));
create policy "production_deliverables_insert" on public.production_deliverables
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_DELIVERABLES') and public.has_permission(company_id, 'PRODUCTION.DELIVERABLES.CREATE'));
create policy "production_deliverables_update" on public.production_deliverables
  for update using (public.has_permission(company_id, 'PRODUCTION.DELIVERABLES.UPDATE')) with check (public.has_permission(company_id, 'PRODUCTION.DELIVERABLES.UPDATE'));
create policy "production_deliverables_delete" on public.production_deliverables
  for delete using (public.has_permission(company_id, 'PRODUCTION.DELIVERABLES.UPDATE'));

create trigger trg_production_deliverables_updated_at before update on public.production_deliverables for each row execute function public.set_updated_at();

create or replace function public.before_insert_production_deliverable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.deliverable_code is null or new.deliverable_code = '' then
    new.deliverable_code := public.generate_asset_code(new.company_id, 'DLV');
  end if;
  return new;
end;
$$;

create trigger trg_before_insert_production_deliverable
  before insert on public.production_deliverables
  for each row execute function public.before_insert_production_deliverable();

-- ---------------------------------------------------------------------
-- Production files: metadata table + private bucket, mirroring
-- admin_documents/admin-documents exactly.
-- ---------------------------------------------------------------------
create table public.production_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type text not null check (resource_type in ('PROJECT', 'SHOT', 'ASSET', 'VERSION', 'DELIVERABLE')),
  resource_id uuid not null,
  filename text not null,
  storage_path text not null,
  file_type text,
  file_size bigint,
  checksum text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index idx_production_files_resource on public.production_files(resource_type, resource_id);

alter table public.production_files enable row level security;

create policy "production_files_select" on public.production_files
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_DELIVERABLES'));
create policy "production_files_insert" on public.production_files
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'PRODUCTION_DELIVERABLES') and public.has_permission(company_id, 'PRODUCTION.FILES.UPLOAD') and uploaded_by = auth.uid());
create policy "production_files_delete" on public.production_files
  for delete using (public.has_permission(company_id, 'PRODUCTION.FILES.DELETE'));

insert into storage.buckets (id, name, public)
values ('production-files', 'production-files', false)
on conflict (id) do nothing;

create policy "production_files_storage_select" on storage.objects
  for select
  using (
    bucket_id = 'production-files'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_module_enabled(((storage.foldername(name))[1])::uuid, 'PRODUCTION_DELIVERABLES')
  );

create policy "production_files_storage_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'production-files'
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'PRODUCTION.FILES.UPLOAD')
  );

create policy "production_files_storage_delete" on storage.objects
  for delete
  using (
    bucket_id = 'production-files'
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'PRODUCTION.FILES.DELETE')
  );

grant select, insert, update, delete on public.production_deliverables, public.production_files to authenticated;
