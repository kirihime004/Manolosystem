-- =========================================================================
-- PRODUCTION RATE CARD + APPROVED WORK PAYMENT SYSTEM -- Part 7: RLS.
--
-- No INSERT/UPDATE policies are needed on any of the three tables --
-- every write happens exclusively through the SECURITY DEFINER RPCs in
-- migrations 187-188 (which bypass RLS by design, the same "no client-
-- facing write policy" convention budget_transactions already uses).
-- Only SELECT is gated here.
-- =========================================================================

create policy "production_work_earnings_select" on public.production_work_earnings
  for select using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'PRODUCTION.WORK.VIEW_ALL')
      or public.has_permission(company_id, 'FINANCE.PAYROLL.VIEW')
      or public.has_permission(company_id, 'FINANCE.PAYROLL.PROCESS')
      or exists (
        select 1 from public.employees e
        where e.id = production_work_earnings.employee_id and e.user_id = auth.uid()
      )
    )
  );

create policy "production_work_approvals_select" on public.production_work_approvals
  for select using (
    public.has_company_access(company_id)
    and (
      approver_id = auth.uid()
      or public.has_permission(company_id, 'PRODUCTION.WORK.APPROVE')
      or exists (
        select 1 from public.production_work_earnings we
        join public.employees e on e.id = we.employee_id
        where we.id = production_work_approvals.work_earning_id and e.user_id = auth.uid()
      )
    )
  );

create policy "production_work_adjustments_select" on public.production_work_adjustments
  for select using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'PRODUCTION.WORK.VIEW_ALL')
      or public.has_permission(company_id, 'FINANCE.PAYROLL.VIEW')
      or exists (
        select 1 from public.production_work_earnings we
        join public.employees e on e.id = we.employee_id
        where we.id = production_work_adjustments.work_earning_id and e.user_id = auth.uid()
      )
    )
  );
