-- Private bucket for ticket attachments. Never public; always accessed via
-- signed URLs generated server-side (or client-side under RLS) after the
-- caller has proven access to the specific ticket.
insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-attachments', 'ticket-attachments', false, 26214400)
on conflict (id) do nothing;

-- Expected object path: companies/{company_id}/tickets/{ticket_id}/{filename}
-- storage.foldername(name) => {'companies', company_id, 'tickets', ticket_id}
create policy "ticket_attachments_storage_select" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) >= 4
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'tickets'
    and public.has_company_access(((storage.foldername(name))[2])::uuid)
    and public.can_view_ticket(((storage.foldername(name))[4])::uuid)
  );

create policy "ticket_attachments_storage_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and array_length(storage.foldername(name), 1) >= 4
    and (storage.foldername(name))[1] = 'companies'
    and (storage.foldername(name))[3] = 'tickets'
    and public.has_company_access(((storage.foldername(name))[2])::uuid)
    and public.can_view_ticket(((storage.foldername(name))[4])::uuid)
    and public.has_permission(((storage.foldername(name))[2])::uuid, 'IT.TICKETS.COMMENT')
  );

-- Company logos: public read (they're displayed on the pre-login screens),
-- write restricted to Platform Superadmin.
insert into storage.buckets (id, name, public, file_size_limit)
values ('company-logos', 'company-logos', true, 5242880)
on conflict (id) do nothing;

create policy "company_logos_storage_select" on storage.objects
  for select
  using (bucket_id = 'company-logos');

create policy "company_logos_storage_write" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'company-logos' and public.is_platform_superadmin())
  with check (bucket_id = 'company-logos' and public.is_platform_superadmin());
