-- Lets Platform Superadmin set a per-company background image for that
-- company's own login screen (/c/{slug}/login), the same way they can
-- already set a company logo. Reuses the existing company-logos bucket and
-- its RLS (public read, write restricted to is_platform_superadmin()) --
-- only a new column and a public read path are needed.
alter table public.companies add column login_background_url text;

-- The company login page is pre-auth, so it reads company display info
-- through this same public, minimal-surface RPC as the name/logo. Postgres
-- won't let CREATE OR REPLACE change a function's OUT-parameter signature,
-- so the old 3-column version has to be dropped first.
drop function if exists public.lookup_company_by_slug(text);

create function public.lookup_company_by_slug(p_slug text)
returns table (name text, logo_url text, login_background_url text, status text)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select c.name, c.logo_url, c.login_background_url, c.status::text
  from public.companies c
  where c.slug = p_slug;
$$;

-- DROP CASCADE removed the grant along with the old function; reinstate it.
grant execute on function public.lookup_company_by_slug(text) to anon, authenticated;
