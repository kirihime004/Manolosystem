-- Private bucket for asset documents (the asset detail page's Documents
-- tab) and disposal attachments. Never public; accessed via signed URLs
-- after the caller has proven inventory access, same pattern as
-- ticket-attachments.
insert into storage.buckets (id, name, public, file_size_limit)
values ('asset-attachments', 'asset-attachments', false, 26214400)
on conflict (id) do nothing;

-- Expected object path: {company_id}/{asset_id}/{filename}
create policy "asset_attachments_storage_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'asset-attachments'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'IT.INVENTORY.VIEW')
  );

create policy "asset_attachments_storage_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'asset-attachments'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'IT.INVENTORY.UPDATE')
  );

create policy "asset_attachments_storage_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'asset-attachments'
    and array_length(storage.foldername(name), 1) >= 2
    and public.has_company_access(((storage.foldername(name))[1])::uuid)
    and public.has_permission(((storage.foldername(name))[1])::uuid, 'IT.INVENTORY.UPDATE')
  );
