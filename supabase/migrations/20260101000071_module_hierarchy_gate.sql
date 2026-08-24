-- =========================================================================
-- Wires up the new leaf keys: backfills a row per existing company (copying
-- the parent's current enabled state, so nothing changes in what's visible
-- today), makes has_module_enabled() cascade a child's check through its
-- parent, and moves Ticketing's own RLS from the now-parent-only 'IT' key
-- onto the new 'TICKETING' key. INVENTORY/PROCUREMENT already have their
-- own keys and already call has_module_enabled(company_id, 'INVENTORY'/
-- 'PROCUREMENT') everywhere -- those call sites need zero changes, since
-- the cascade now lives inside the shared function itself.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Backfill: TICKETING copies IT's current value; the three HR leaves
-- copy HR's current value (HR was previously the single switch for all
-- of Phase 4, so this preserves exactly what was visible before).
-- ---------------------------------------------------------------------
insert into public.company_modules (company_id, module_key, enabled)
select cm.company_id, 'TICKETING'::public.module_key, cm.enabled
from public.company_modules cm
where cm.module_key = 'IT'
on conflict (company_id, module_key) do nothing;

insert into public.company_modules (company_id, module_key, enabled)
select cm.company_id, sub.key, cm.enabled
from public.company_modules cm
cross join (values ('HR_EMPLOYEES'::public.module_key), ('HR_ATTENDANCE_LEAVE'::public.module_key), ('HR_PAYROLL'::public.module_key)) as sub(key)
where cm.module_key = 'HR'
on conflict (company_id, module_key) do nothing;

-- ---------------------------------------------------------------------
-- has_module_enabled(): a leaf module is only "enabled" when both its own
-- toggle AND its parent's toggle are on. Non-leaf keys (IT, HR, and the
-- still-standalone FINANCE/ADMIN/PRODUCTION/INVENTORY/PROCUREMENT) are
-- unaffected -- they just check their own row, exactly as before.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Move ticket RLS off the now-parent-only 'IT' key and onto 'TICKETING'.
-- can_view_ticket() is a function, so redefining it is enough for every
-- policy that calls it (comments/attachments) -- only the three policies
-- on `tickets` itself and the four on ticket_categories/subcategories
-- embed the check directly and need to be dropped and recreated.
-- ---------------------------------------------------------------------
create or replace function public.can_view_ticket(p_ticket_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and public.has_company_access(t.company_id)
      and public.has_module_enabled(t.company_id, 'TICKETING')
      and (
        t.requester_id = auth.uid()
        or t.assigned_to = auth.uid()
        or public.has_permission(t.company_id, 'IT.TICKETS.VIEW')
      )
  );
$$;

drop policy "tickets_select" on public.tickets;
create policy "tickets_select" on public.tickets
  for select
  using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'TICKETING')
    and (
      requester_id = auth.uid()
      or assigned_to = auth.uid()
      or public.has_permission(company_id, 'IT.TICKETS.VIEW')
    )
  );

drop policy "tickets_insert" on public.tickets;
create policy "tickets_insert" on public.tickets
  for insert
  with check (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'TICKETING')
    and requester_id = auth.uid()
    and public.has_permission(company_id, 'IT.TICKETS.CREATE')
  );

drop policy "tickets_update" on public.tickets;
create policy "tickets_update" on public.tickets
  for update
  using (
    public.has_company_access(company_id)
    and public.has_module_enabled(company_id, 'TICKETING')
    and (
      requester_id = auth.uid()
      or assigned_to = auth.uid()
      or public.has_permission(company_id, 'IT.TICKETS.UPDATE')
      or public.has_permission(company_id, 'IT.TICKETS.ASSIGN')
      or public.has_permission(company_id, 'IT.TICKETS.RESOLVE')
      or public.has_permission(company_id, 'IT.TICKETS.CLOSE')
    )
  )
  with check (public.has_company_access(company_id));

drop policy "ticket_categories_select_members" on public.ticket_categories;
create policy "ticket_categories_select_members" on public.ticket_categories
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'TICKETING'));

drop policy "ticket_categories_write_admin" on public.ticket_categories;
create policy "ticket_categories_write_admin" on public.ticket_categories
  for all
  using (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'TICKETING'))
  )
  with check (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'TICKETING'))
  );

drop policy "ticket_subcategories_select_members" on public.ticket_subcategories;
create policy "ticket_subcategories_select_members" on public.ticket_subcategories
  for select
  using (public.has_company_access(company_id) and public.has_module_enabled(company_id, 'TICKETING'));

drop policy "ticket_subcategories_write_admin" on public.ticket_subcategories;
create policy "ticket_subcategories_write_admin" on public.ticket_subcategories
  for all
  using (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'TICKETING'))
  )
  with check (
    public.is_platform_superadmin()
    or (public.has_permission(company_id, 'ADMIN.IT_CATEGORIES.MANAGE') and public.has_module_enabled(company_id, 'TICKETING'))
  );
