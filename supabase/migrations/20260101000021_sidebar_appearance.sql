-- Lets Company Admin customize their own company's sidebar background
-- (solid color or uploaded image), separate from the company name/logo/
-- login-background fields which stay Platform Superadmin-only.
alter table public.companies add column sidebar_background_url text;
alter table public.companies add column sidebar_background_color text;

-- RLS only decides WHO may attempt an UPDATE on a company row -- it can't
-- restrict which columns they touch. This new policy lets a Company Admin
-- (ADMIN.COMPANY_SETTINGS.MANAGE) update their own company row at all;
-- the trigger below is the actual column-level guard, so a compromised or
-- buggy client can't smuggle a name/logo/status change through the new
-- policy's door.
create policy "companies_update_company_admin" on public.companies
  for update
  using (public.has_permission(id, 'ADMIN.COMPANY_SETTINGS.MANAGE'))
  with check (public.has_permission(id, 'ADMIN.COMPANY_SETTINGS.MANAGE'));

create or replace function public.protect_company_admin_only_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.is_platform_superadmin() then
    return new;
  end if;

  if new.name is distinct from old.name
     or new.slug is distinct from old.slug
     or new.code is distinct from old.code
     or new.status is distinct from old.status
     or new.logo_url is distinct from old.logo_url
     or new.login_background_url is distinct from old.login_background_url then
    raise exception 'Only a Platform Superadmin can change this field';
  end if;

  return new;
end;
$$;

create trigger protect_company_admin_only_columns_trigger
  before update on public.companies
  for each row execute function public.protect_company_admin_only_columns();

-- Broaden the company-logos bucket's write policy so a Company Admin can
-- upload into their own company's folder (company_id parsed from the
-- object path, same pattern as the ticket-attachments bucket) without
-- gaining the ability to write into any other company's folder.
drop policy if exists "company_logos_storage_write" on storage.objects;

create policy "company_logos_storage_write" on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'company-logos'
    and (
      public.is_platform_superadmin()
      or public.has_permission(((storage.foldername(name))[1])::uuid, 'ADMIN.COMPANY_SETTINGS.MANAGE')
    )
  )
  with check (
    bucket_id = 'company-logos'
    and (
      public.is_platform_superadmin()
      or public.has_permission(((storage.foldername(name))[1])::uuid, 'ADMIN.COMPANY_SETTINGS.MANAGE')
    )
  );
