-- Lets Company Admin change their own company's icon/logo, alongside the
-- sidebar branding they already manage. name/slug/code/status/
-- login_background_url stay Platform Superadmin-only.
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
     or new.login_background_url is distinct from old.login_background_url then
    raise exception 'Only a Platform Superadmin can change this field';
  end if;

  return new;
end;
$$;
