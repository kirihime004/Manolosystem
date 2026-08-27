-- =========================================================================
-- Fix: scan_for_ai_alerts() used initcap(v_module) for the alert title,
-- which renders 'it' as "It" instead of "IT" (and would do the same to
-- "Hr"). IT and HR are acronyms, not titlecase words; Finance/Admin/
-- Production are the only ones initcap ever got right by coincidence.
-- =========================================================================
create or replace function public.scan_for_ai_alerts(p_company_id uuid)
returns setof public.ai_alerts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context jsonb;
  v_module text;
  v_status text;
  v_severity text;
  v_display_name text;
begin
  if not public.has_permission(p_company_id, 'AI.COMPANY_ANALYTICS.VIEW') then
    raise exception 'Access denied';
  end if;

  v_context := public.get_company_ai_context(p_company_id);

  for v_module in select unnest(array['it', 'hr', 'finance', 'admin', 'production'])
  loop
    v_status := v_context->'modules'->v_module->>'status';
    continue when v_status = 'GREEN';
    v_severity := case v_status when 'RED' then 'HIGH' else 'MEDIUM' end;
    v_display_name := case v_module
      when 'it' then 'IT'
      when 'hr' then 'HR'
      else initcap(v_module)
    end;

    if not exists (
      select 1 from public.ai_alerts
      where company_id = p_company_id and module = upper(v_module) and status = 'OPEN'
    ) then
      insert into public.ai_alerts (company_id, module, severity, title, description, evidence)
      values (
        p_company_id, upper(v_module), v_severity,
        v_display_name || ' is ' || v_status,
        'Detected from real ' || v_display_name || ' metrics at ' || now()::text || '.',
        v_context->'modules'->v_module
      );
    end if;
  end loop;

  return query select * from public.ai_alerts where company_id = p_company_id and status = 'OPEN' order by created_at desc;
end;
$$;

grant execute on function public.scan_for_ai_alerts(uuid) to authenticated;
