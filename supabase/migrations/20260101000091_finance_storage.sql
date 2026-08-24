-- =========================================================================
-- PHASE 5: Finance & Accounting -- private document storage for receipts,
-- invoices, payment proof, and tax documents. Same private-bucket +
-- signed-URL + FINANCE.DOCUMENTS.* permission pattern as HR's
-- employee-documents bucket. Path convention:
-- {company_id}/{resource_type}/{resource_id}/{filename}
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('finance-documents', 'finance-documents', false, 26214400)
on conflict (id) do nothing;

create policy "finance_documents_storage_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'finance-documents'
    and array_length(storage.foldername(name), 1) >= 1
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'FINANCE.DOCUMENTS.VIEW')
  );

create policy "finance_documents_storage_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'finance-documents'
    and array_length(storage.foldername(name), 1) >= 1
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'FINANCE.DOCUMENTS.CREATE')
  );

create policy "finance_documents_storage_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'finance-documents'
    and array_length(storage.foldername(name), 1) >= 1
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'FINANCE.DOCUMENTS.DELETE')
  );
