-- Private bucket for procurement documents (quotations, vendor proposals,
-- approval documents, invoices, receipts, delivery notes, warranty docs).
-- Never public; accessed via signed URLs after the caller has proven
-- procurement access, same pattern as ticket-attachments/asset-attachments.
insert into storage.buckets (id, name, public, file_size_limit)
values ('procurement-documents', 'procurement-documents', false, 26214400)
on conflict (id) do nothing;

-- Expected object path: {company_id}/{resource_type}/{resource_id}/{filename}
create policy "procurement_documents_storage_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'procurement-documents'
    and array_length(storage.foldername(name), 1) >= 3
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_module_enabled(((storage.foldername(name))[1])::uuid, 'PROCUREMENT')
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'IT.PROCUREMENT.VIEW')
  );

create policy "procurement_documents_storage_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'procurement-documents'
    and array_length(storage.foldername(name), 1) >= 3
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_module_enabled(((storage.foldername(name))[1])::uuid, 'PROCUREMENT')
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'IT.PROCUREMENT.UPDATE')
  );

create policy "procurement_documents_storage_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'procurement-documents'
    and array_length(storage.foldername(name), 1) >= 3
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_module_enabled(((storage.foldername(name))[1])::uuid, 'PROCUREMENT')
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'IT.PROCUREMENT.UPDATE')
  );
