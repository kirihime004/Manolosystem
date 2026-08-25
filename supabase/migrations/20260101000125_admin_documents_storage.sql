-- =========================================================================
-- PHASE 6: Administration -- one shared document metadata table +
-- private storage bucket for every Admin document type (contracts,
-- compliance certs, travel documents, facility/vehicle/event documents),
-- following the {company_id}/{resource_type}/{resource_id}/{filename}
-- convention Procurement (20260101000041) and Finance (20260101000091)
-- already established, rather than one bucket per sub-domain. Never a
-- public URL -- every read is RLS-gated then served via a signed URL,
-- exactly like every other private bucket in this app.
-- =========================================================================
create table public.admin_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  resource_type text not null check (resource_type in (
    'ADMIN_REQUEST', 'LOCATION', 'ROOM', 'ADMIN_ASSET', 'VEHICLE', 'TRAVEL_REQUEST',
    'ADMIN_CONTRACT', 'ADMIN_COMPLIANCE', 'EVENT', 'OTHER'
  )),
  resource_id uuid not null,
  document_type text not null default 'OTHER' check (document_type in (
    'CONTRACT', 'PERMIT', 'LICENSE', 'INSURANCE', 'POLICY', 'REGISTRATION',
    'PASSPORT', 'VISA', 'FLIGHT_CONFIRMATION', 'HOTEL_CONFIRMATION', 'RECEIPT', 'OTHER'
  )),
  title text not null,
  storage_path text not null,
  issue_date date,
  expiry_date date,
  uploaded_by uuid references auth.users(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXPIRED', 'ARCHIVED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_documents_resource_idx on public.admin_documents (company_id, resource_type, resource_id);
create index admin_documents_expiry_idx on public.admin_documents (company_id, expiry_date) where status = 'ACTIVE';

create trigger set_admin_documents_updated_at
  before update on public.admin_documents
  for each row execute function public.set_updated_at();

alter table public.admin_documents enable row level security;

create policy "admin_documents_select" on public.admin_documents
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.DOCUMENTS.VIEW'));
create policy "admin_documents_insert" on public.admin_documents
  for insert
  with check (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN') and public.has_permission(company_id, 'ADMIN.DOCUMENTS.UPLOAD'));
create policy "admin_documents_update" on public.admin_documents
  for update
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.DOCUMENTS.UPLOAD'))
  with check (public.has_company_access(company_id));
create policy "admin_documents_delete" on public.admin_documents
  for delete
  using (public.has_company_access(company_id) and public.has_permission(company_id, 'ADMIN.DOCUMENTS.DELETE'));

-- ---------------------------------------------------------------------
-- Storage bucket + RLS on storage.objects. Path convention:
-- {company_id}/{resource_type}/{resource_id}/{filename}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('admin-documents', 'admin-documents', false, 26214400)
on conflict (id) do nothing;

create policy "admin_documents_storage_select" on storage.objects
  for select
  using (
    bucket_id = 'admin-documents'
    and array_length(storage.foldername(name), 1) >= 3
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'ADMIN.DOCUMENTS.VIEW')
  );

create policy "admin_documents_storage_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'admin-documents'
    and array_length(storage.foldername(name), 1) >= 3
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'ADMIN.DOCUMENTS.UPLOAD')
  );

create policy "admin_documents_storage_delete" on storage.objects
  for delete
  using (
    bucket_id = 'admin-documents'
    and array_length(storage.foldername(name), 1) >= 3
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'ADMIN.DOCUMENTS.DELETE')
  );
