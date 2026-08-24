-- =========================================================================
-- Same treatment IT/HR got in 000070/000071: FINANCE has been one flat
-- switch since Phase 5 shipped, so Platform Superadmin can't turn off, say,
-- Payroll for a company that shouldn't process it while leaving Accounting
-- on. This adds six leaf keys, one per Finance section that already has its
-- own nav grouping and RLS surface (Accounting, AP, AR, Expenses, Cash &
-- Bank, Payroll) so FINANCE can become a pure master switch in the next
-- migration. Enum values need their own transaction before anything can
-- reference them.
-- =========================================================================
alter type public.module_key add value 'FINANCE_ACCOUNTING';
alter type public.module_key add value 'FINANCE_AP';
alter type public.module_key add value 'FINANCE_AR';
alter type public.module_key add value 'FINANCE_EXPENSES';
alter type public.module_key add value 'FINANCE_BANK';
alter type public.module_key add value 'FINANCE_PAYROLL';
