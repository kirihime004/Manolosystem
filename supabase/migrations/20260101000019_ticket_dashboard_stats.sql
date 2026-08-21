-- Server-side aggregation for the Ticketing dashboard. Previously the
-- frontend fetched every single ticket (fully enriched with profiles and
-- categories) just to compute eight counts and slice out five items for
-- each mini-list -- fine at a handful of tickets, but it means downloading
-- and re-processing the entire company's ticket history on every dashboard
-- load, which stops scaling once a company has a few hundred tickets.
--
-- This is intentionally NOT security definer: it runs as the calling role,
-- so the existing tickets_select RLS policy applies exactly as it does for
-- any other query -- a non-IT.TICKETS.VIEW caller transparently gets counts
-- scoped to just their own requester/assignee tickets, which is also
-- exactly the aggregation the personal "My Tickets" dashboard view needs.
create or replace function public.get_ticket_dashboard_stats(p_company_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with scoped as (
    select * from public.tickets where company_id = p_company_id
  ),
  status_agg as (
    select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb) as j
    from (select status, count(*) as cnt from scoped group by status) s
  ),
  priority_agg as (
    select coalesce(jsonb_object_agg(priority, cnt), '{}'::jsonb) as j
    from (select priority, count(*) as cnt from scoped group by priority) p
  )
  select jsonb_build_object(
    'open', (select count(*) from scoped where status = 'OPEN'),
    'assignedToMe', (
      select count(*) from scoped
      where assigned_to = auth.uid() and status not in ('RESOLVED', 'CLOSED', 'CANCELLED')
    ),
    'inProgress', (select count(*) from scoped where status = 'IN_PROGRESS'),
    'waitingForUser', (select count(*) from scoped where status = 'WAITING_FOR_USER'),
    'critical', (
      select count(*) from scoped
      where priority = 'CRITICAL' and status not in ('RESOLVED', 'CLOSED', 'CANCELLED')
    ),
    'overdue', (
      select count(*) from scoped
      where status not in ('RESOLVED', 'CLOSED', 'CANCELLED') and created_at < now() - interval '48 hours'
    ),
    'resolvedToday', (select count(*) from scoped where resolved_at >= date_trunc('day', now())),
    'closedToday', (select count(*) from scoped where closed_at >= date_trunc('day', now())),
    'resolved', (select count(*) from scoped where status = 'RESOLVED'),
    'closed', (select count(*) from scoped where status = 'CLOSED'),
    -- Distinct from 'open' (strictly status = OPEN, used by the staff
    -- per-status cards): this is "still needs attention" -- any non-final
    -- status -- used by the single consolidated "Open" card in the
    -- personal (non-staff) dashboard view.
    'active', (select count(*) from scoped where status not in ('RESOLVED', 'CLOSED', 'CANCELLED')),
    'statusCounts', (select j from status_agg),
    'priorityCounts', (select j from priority_agg)
  );
$$;

grant execute on function public.get_ticket_dashboard_stats(uuid) to authenticated;
