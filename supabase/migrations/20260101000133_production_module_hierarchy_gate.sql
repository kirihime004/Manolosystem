-- =========================================================================
-- Wires up the eight new Production leaf keys, mirroring 099/131 exactly:
-- backfill a row per existing company (copying PRODUCTION's current
-- enabled state) and extend has_module_enabled()'s cascade. No RLS policy
-- moves are needed here (unlike the Admin retrofit) because every
-- Production table created from this point on is written with its leaf
-- key from the start.
-- =========================================================================
insert into public.company_modules (company_id, module_key, enabled)
select cm.company_id, sub.key, cm.enabled
from public.company_modules cm
cross join (values
  ('PRODUCTION_PROJECTS'::public.module_key),
  ('PRODUCTION_SHOTS'::public.module_key),
  ('PRODUCTION_ASSETS'::public.module_key),
  ('PRODUCTION_TASKS'::public.module_key),
  ('PRODUCTION_SCHEDULE'::public.module_key),
  ('PRODUCTION_VERSIONS'::public.module_key),
  ('PRODUCTION_DELIVERABLES'::public.module_key),
  ('PRODUCTION_RESOURCES'::public.module_key)
) as sub(key)
where cm.module_key = 'PRODUCTION'
on conflict (company_id, module_key) do nothing;

create or replace function public.has_module_enabled(p_company_id uuid, p_module_key public.module_key)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_parent_key public.module_key;
  v_own_enabled boolean;
  v_parent_enabled boolean;
begin
  if public.is_platform_superadmin() then
    return true;
  end if;

  v_parent_key := case p_module_key
    when 'TICKETING' then 'IT'
    when 'INVENTORY' then 'IT'
    when 'PROCUREMENT' then 'IT'
    when 'HR_EMPLOYEES' then 'HR'
    when 'HR_ATTENDANCE_LEAVE' then 'HR'
    when 'HR_PAYROLL' then 'HR'
    when 'FINANCE_ACCOUNTING' then 'FINANCE'
    when 'FINANCE_AP' then 'FINANCE'
    when 'FINANCE_AR' then 'FINANCE'
    when 'FINANCE_EXPENSES' then 'FINANCE'
    when 'FINANCE_BANK' then 'FINANCE'
    when 'FINANCE_PAYROLL' then 'FINANCE'
    when 'ADMIN_REQUESTS' then 'ADMIN'
    when 'ADMIN_FACILITIES' then 'ADMIN'
    when 'ADMIN_SUPPLIES' then 'ADMIN'
    when 'ADMIN_ASSETS' then 'ADMIN'
    when 'ADMIN_VEHICLES' then 'ADMIN'
    when 'ADMIN_TRAVEL' then 'ADMIN'
    when 'ADMIN_VISITORS' then 'ADMIN'
    when 'ADMIN_EVENTS' then 'ADMIN'
    when 'ADMIN_CONTRACTS' then 'ADMIN'
    when 'ADMIN_COMMS' then 'ADMIN'
    when 'PRODUCTION_PROJECTS' then 'PRODUCTION'
    when 'PRODUCTION_SHOTS' then 'PRODUCTION'
    when 'PRODUCTION_ASSETS' then 'PRODUCTION'
    when 'PRODUCTION_TASKS' then 'PRODUCTION'
    when 'PRODUCTION_SCHEDULE' then 'PRODUCTION'
    when 'PRODUCTION_VERSIONS' then 'PRODUCTION'
    when 'PRODUCTION_DELIVERABLES' then 'PRODUCTION'
    when 'PRODUCTION_RESOURCES' then 'PRODUCTION'
    else null
  end;

  select exists (
    select 1 from public.company_modules cm
    where cm.company_id = p_company_id and cm.module_key = p_module_key and cm.enabled = true
  ) into v_own_enabled;

  if v_parent_key is null then
    return v_own_enabled;
  end if;

  select exists (
    select 1 from public.company_modules cm
    where cm.company_id = p_company_id and cm.module_key = v_parent_key and cm.enabled = true
  ) into v_parent_enabled;

  return v_own_enabled and v_parent_enabled;
end;
$$;

grant execute on function public.has_module_enabled(uuid, public.module_key) to authenticated;
