-- =========================================================================
-- Fix: when Production integration landed (20260101000144), customer_
-- invoices/customer_invoice_items.project_id correctly got their FK added
-- retroactively to the SAME column that had been left un-FK'd specifically
-- anticipating this ("Phase 7 Production doesn't exist yet" -- Phase 5's
-- own comment on that column). For expenses, instead of doing the same to
-- its existing, identically-unconstrained project_id, that migration added
-- a brand-new expenses.production_project_id column instead. The live UI
-- (financeExpensesApi.ts) has always written project_id -- unconstrained,
-- no cascade, can hold a dangling id -- while production_project_id, the
-- indexed/FK'd "correct" column, has zero rows and zero references
-- anywhere in src/. Confirmed empty on both sides before this migration;
-- consolidating onto one column, matching the customer_invoices treatment.
-- =========================================================================

drop index if exists public.idx_expenses_production_project;
alter table public.expenses drop column production_project_id;

alter table public.expenses
  add constraint expenses_project_id_fkey foreign key (project_id) references public.production_projects(id) on delete set null;
