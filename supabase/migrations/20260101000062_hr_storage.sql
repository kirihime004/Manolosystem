-- =========================================================================
-- PHASE 4: Private storage for employee photos and HR documents. Both
-- buckets are non-public; every read goes through a signed URL after RLS
-- has proven access, same pattern as ticket-attachments/asset-attachments.
-- Expected object path: {company_id}/{employee_id}/{filename}
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('employee-photos', 'employee-photos', false, 5242880)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('employee-documents', 'employee-documents', false, 26214400)
on conflict (id) do nothing;

-- An employee may always see/replace their own photo, in addition to
-- anyone holding HR.EMPLOYEES.VIEW/UPDATE.
create or replace function public.is_own_employee(p_employee_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.employees e where e.id = p_employee_id and e.user_id = auth.uid()
  );
$$;

create policy "employee_photos_storage_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'employee-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'HR.EMPLOYEES.VIEW')
      or public.is_own_employee(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "employee_photos_storage_write" on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'employee-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'HR.EMPLOYEES.UPDATE')
      or public.is_own_employee(((storage.foldername(name))[2])::uuid)
    )
  )
  with check (
    bucket_id = 'employee-photos'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'HR.EMPLOYEES.UPDATE')
      or public.is_own_employee(((storage.foldername(name))[2])::uuid)
    )
  );

-- Employee documents are sensitive -- no self-service write path. An
-- employee can view their own (HR.EMPLOYEES.VIEW_SENSITIVE is not
-- required for one's own records), but only HR can upload/delete.
create policy "employee_documents_storage_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and (
      public.has_permission(((storage.foldername(name))[1])::uuid, 'HR.DOCUMENTS.VIEW')
      or public.is_own_employee(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "employee_documents_storage_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'employee-documents'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'HR.DOCUMENTS.CREATE')
  );

create policy "employee_documents_storage_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'HR.DOCUMENTS.DELETE')
  );
