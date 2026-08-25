-- =========================================================================
-- PHASE 7: Finance/Procurement integration. Zero new budget/expense/
-- procurement tables -- Production links into the existing engines built
-- in Phase 2/3/5:
--
--   * customer_invoices/customer_invoice_items.project_id was left
--     un-FK'd back in Phase 5 specifically anticipating this table --
--     add the real FK now that production_projects exists.
--   * production_projects.budget_id links a project to one company
--     budget (created the normal way through the existing Budget UI);
--     get_production_budget_summary() below just re-reads
--     v_budget_summary for that budget, no new tables.
--   * purchase_requests.production_project_id lets an equipment/software
--     request (already using the existing 'HARDWARE'/'SOFTWARE'
--     asset_type values -- no widening needed) be tagged to a project.
--   * expenses.production_project_id does the same for cost tracking;
--     expenses.category already contains a literal 'PRODUCTION' value
--     seeded all the way back in the original Phase 5 migration.
-- =========================================================================

alter table public.customer_invoices
  add constraint customer_invoices_project_id_fkey foreign key (project_id) references public.production_projects(id) on delete set null;
alter table public.customer_invoice_items
  add constraint customer_invoice_items_project_id_fkey foreign key (project_id) references public.production_projects(id) on delete set null;

alter table public.production_projects add column budget_id uuid references public.budgets(id) on delete set null;

alter table public.purchase_requests add column production_project_id uuid references public.production_projects(id) on delete set null;
alter table public.expenses add column production_project_id uuid references public.production_projects(id) on delete set null;

create index idx_purchase_requests_production_project on public.purchase_requests(production_project_id);
create index idx_expenses_production_project on public.expenses(production_project_id);

create or replace function public.get_production_budget_summary(p_project_id uuid)
returns table (
  budget_id uuid,
  budget_name text,
  total_budget numeric,
  allocated numeric,
  spent numeric,
  remaining numeric,
  currency_code text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    vs.id, vs.budget_name, vs.total_budget, vs.allocated, vs.spent, vs.remaining, c.code
  from public.production_projects p
  join public.v_budget_summary vs on vs.id = p.budget_id
  join public.currencies c on c.id = vs.currency_id
  where p.id = p_project_id and public.has_company_access(p.company_id) and public.has_permission(p.company_id, 'PRODUCTION.BUDGET.VIEW');
$$;

grant execute on function public.get_production_budget_summary(uuid) to authenticated;
