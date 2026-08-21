-- =========================================================================
-- Let Platform Superadmin (and Company Admins, for their own company) see
-- the email addresses of company members. auth.users is never exposed
-- directly via PostgREST; this is the narrow, read-only bridge -- it
-- returns rows only when the caller is authorized for that company at all,
-- otherwise nothing.
-- =========================================================================
create or replace function public.get_company_member_emails(p_company_id uuid)
returns table (user_id uuid, email text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select cu.user_id, u.email
  from public.company_users cu
  join auth.users u on u.id = cu.user_id
  where cu.company_id = p_company_id
    and (public.is_platform_superadmin() or public.has_permission(p_company_id, 'ADMIN.USERS.MANAGE'));
$$;

grant execute on function public.get_company_member_emails(uuid) to authenticated;

-- =========================================================================
-- Platform Superadmin can permanently remove a user's membership from a
-- company (distinct from Company Admin's DISABLED status toggle, which is
-- reversible and self-service). This only ever deletes the company_users
-- row -- cascades to that company's user_roles -- never the underlying
-- auth.users account or any other company's membership, matching "a user
-- may belong to multiple companies."
create policy "company_users_delete_platform_admin" on public.company_users
  for delete
  using (public.is_platform_superadmin());

-- =========================================================================
-- Avatars: public read (shown throughout the app to company peers), write
-- restricted to the owning user's own folder.
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 5242880)
on conflict (id) do nothing;

create policy "avatars_storage_select" on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_storage_write_own" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
