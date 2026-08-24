import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as coreApi from "@/features/finance/financeCoreApi";
import * as apApi from "@/features/finance/financeApApi";
import * as arApi from "@/features/finance/financeArApi";
import * as expensesApi from "@/features/finance/financeExpensesApi";
import * as cashBankApi from "@/features/finance/financeCashBankApi";
import * as taxApi from "@/features/finance/financeTaxApi";
import * as payrollApi from "@/features/finance/financePayrollApi";
import * as reportsApi from "@/features/finance/financeReportsApi";
import type { JournalEntryFilters, GeneralLedgerFilters } from "@/features/finance/financeCoreApi";
import type { SupplierBillFilters } from "@/features/finance/financeApApi";
import type { CustomerInvoiceFilters } from "@/features/finance/financeArApi";
import type { ExpenseFilters } from "@/features/finance/financeExpensesApi";
import type { BankTransactionFilters } from "@/features/finance/financeCashBankApi";

// ---------------------------------------------------------------------
// Fiscal years & periods
// ---------------------------------------------------------------------
export function useFiscalYears(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-fiscal-years", companyId], queryFn: () => coreApi.listFiscalYears(companyId!), enabled: !!companyId });
}

export function useFinancialPeriods(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-periods", companyId], queryFn: () => coreApi.listFinancialPeriods(companyId!), enabled: !!companyId });
}

export function usePeriodCloseChecklist(periodId: string | undefined) {
  return useQuery({ queryKey: ["finance-period-checklist", periodId], queryFn: () => coreApi.getPeriodCloseChecklist(periodId!), enabled: !!periodId });
}

export function useFiscalPeriodMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["finance-fiscal-years", companyId] });
    queryClient.invalidateQueries({ queryKey: ["finance-periods", companyId] });
  };
  const createFiscalYear = useMutation({ mutationFn: coreApi.createFiscalYear, onSuccess: invalidate });
  const generatePeriods = useMutation({
    mutationFn: (input: { fiscalYearId: string; periodType: "MONTHLY" | "QUARTERLY" | "YEARLY" }) =>
      coreApi.generateFinancialPeriods(input.fiscalYearId, input.periodType),
    onSuccess: invalidate,
  });
  const closePeriod = useMutation({
    mutationFn: (input: { id: string; force?: boolean }) => coreApi.closeFinancialPeriod(input.id, input.force),
    onSuccess: invalidate,
  });
  const reopenPeriod = useMutation({
    mutationFn: (input: { id: string; reason: string }) => coreApi.reopenFinancialPeriod(input.id, input.reason),
    onSuccess: invalidate,
  });
  const lockPeriod = useMutation({ mutationFn: coreApi.lockFinancialPeriod, onSuccess: invalidate });
  return { createFiscalYear, generatePeriods, closePeriod, reopenPeriod, lockPeriod };
}

// ---------------------------------------------------------------------
// Chart of Accounts / Cost & Profit Centers
// ---------------------------------------------------------------------
export function useChartOfAccounts(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-coa", companyId], queryFn: () => coreApi.listChartOfAccounts(companyId!), enabled: !!companyId });
}

export function useChartOfAccountsMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-coa", companyId] });
  const create = useMutation({ mutationFn: coreApi.createAccount, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof coreApi.updateAccount>[1] }) => coreApi.updateAccount(input.id, input.patch),
    onSuccess: invalidate,
  });
  const archive = useMutation({ mutationFn: coreApi.archiveAccount, onSuccess: invalidate });
  return { create, update, archive };
}

export function useCostCenters(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-cost-centers", companyId], queryFn: () => coreApi.listCostCenters(companyId!), enabled: !!companyId });
}

export function useCostCenterMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-cost-centers", companyId] });
  const create = useMutation({ mutationFn: coreApi.createCostCenter, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof coreApi.updateCostCenter>[1] }) => coreApi.updateCostCenter(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: coreApi.deleteCostCenter, onSuccess: invalidate });
  return { create, update, remove };
}

export function useProfitCenters(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-profit-centers", companyId], queryFn: () => coreApi.listProfitCenters(companyId!), enabled: !!companyId });
}

export function useProfitCenterMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-profit-centers", companyId] });
  const create = useMutation({ mutationFn: coreApi.createProfitCenter, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof coreApi.updateProfitCenter>[1] }) => coreApi.updateProfitCenter(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: coreApi.deleteProfitCenter, onSuccess: invalidate });
  return { create, update, remove };
}

// ---------------------------------------------------------------------
// Journal Entries / GL / Trial Balance
// ---------------------------------------------------------------------
export function useJournalEntries(companyId: string | undefined, filters: JournalEntryFilters = {}) {
  return useQuery({
    queryKey: ["finance-journal-entries", companyId, filters],
    queryFn: () => coreApi.listJournalEntries(companyId!, filters),
    enabled: !!companyId,
  });
}

export function useJournalEntry(id: string | undefined) {
  return useQuery({ queryKey: ["finance-journal-entry", id], queryFn: () => coreApi.getJournalEntry(id!), enabled: !!id });
}

export function useJournalEntryLines(journalEntryId: string | undefined) {
  return useQuery({ queryKey: ["finance-journal-lines", journalEntryId], queryFn: () => coreApi.getJournalEntryLines(journalEntryId!), enabled: !!journalEntryId });
}

export function useJournalApprovals(journalEntryId: string | undefined) {
  return useQuery({ queryKey: ["finance-journal-approvals", journalEntryId], queryFn: () => coreApi.listMyJournalApprovals(journalEntryId!), enabled: !!journalEntryId });
}

export function useJournalEntryMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["finance-journal-entries", companyId] });
  const invalidateOne = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ["finance-journal-entry", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-journal-lines", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-journal-approvals", id] });
    invalidateList();
  };
  const create = useMutation({ mutationFn: coreApi.createJournalEntry, onSuccess: invalidateList });
  const addLine = useMutation({
    mutationFn: coreApi.addJournalEntryLine,
    onSuccess: (_d, vars) => invalidateOne(vars.journalEntryId),
  });
  const deleteLine = useMutation({
    mutationFn: (input: { id: string; journalEntryId: string }) => coreApi.deleteJournalEntryLine(input.id),
    onSuccess: (_d, vars) => invalidateOne(vars.journalEntryId),
  });
  const submitForApproval = useMutation({ mutationFn: coreApi.submitJournalEntryForApproval, onSuccess: (_d, id) => invalidateOne(id) });
  const post = useMutation({ mutationFn: coreApi.postJournalEntry, onSuccess: (_d, id) => invalidateOne(id) });
  const voidEntry = useMutation({
    mutationFn: (input: { id: string; reason?: string }) => coreApi.voidJournalEntry(input.id, input.reason),
    onSuccess: (_d, vars) => invalidateOne(vars.id),
  });
  const reverse = useMutation({
    mutationFn: (input: { id: string; reason: string; reversalDate?: string }) => coreApi.reverseJournalEntry(input.id, input.reason, input.reversalDate),
    onSuccess: (_d, vars) => invalidateOne(vars.id),
  });
  const decideApproval = useMutation({
    mutationFn: (input: { approvalId: string; journalEntryId: string; decision: "APPROVED" | "REJECTED"; comments?: string }) =>
      coreApi.decideJournalEntryApproval(input.approvalId, input.decision, input.comments),
    onSuccess: (_d, vars) => invalidateOne(vars.journalEntryId),
  });
  return { create, addLine, deleteLine, submitForApproval, post, voidEntry, reverse, decideApproval };
}

export function useGeneralLedger(companyId: string | undefined, filters: GeneralLedgerFilters, page: number, pageSize = 50) {
  return useQuery({
    queryKey: ["finance-gl", companyId, filters, page, pageSize],
    queryFn: () => coreApi.listGeneralLedger(companyId!, filters, page, pageSize),
    enabled: !!companyId,
  });
}

export function useTrialBalance(companyId: string | undefined, financialPeriodId: string | undefined) {
  return useQuery({
    queryKey: ["finance-trial-balance", companyId, financialPeriodId],
    queryFn: () => coreApi.getTrialBalance(companyId!, financialPeriodId!),
    enabled: !!companyId && !!financialPeriodId,
  });
}

// ---------------------------------------------------------------------
// Accounts Payable
// ---------------------------------------------------------------------
export function useSupplierBills(companyId: string | undefined, filters: SupplierBillFilters = {}) {
  return useQuery({ queryKey: ["finance-bills", companyId, filters], queryFn: () => apApi.listSupplierBills(companyId!, filters), enabled: !!companyId });
}

export function useSupplierBill(id: string | undefined) {
  return useQuery({ queryKey: ["finance-bill", id], queryFn: () => apApi.getSupplierBill(id!), enabled: !!id });
}

export function useSupplierBillItems(billId: string | undefined) {
  return useQuery({ queryKey: ["finance-bill-items", billId], queryFn: () => apApi.getSupplierBillItems(billId!), enabled: !!billId });
}

export function useSupplierBillApprovals(billId: string | undefined) {
  return useQuery({ queryKey: ["finance-bill-approvals", billId], queryFn: () => apApi.listSupplierBillApprovals(billId!), enabled: !!billId });
}

export function useSupplierPayments(billId: string | undefined) {
  return useQuery({ queryKey: ["finance-bill-payments", billId], queryFn: () => apApi.listSupplierPayments(billId!), enabled: !!billId });
}

export function useApAging(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-ap-aging", companyId], queryFn: () => apApi.getApAging(companyId!), enabled: !!companyId });
}

export function useSupplierBillMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["finance-bills", companyId] });
    queryClient.invalidateQueries({ queryKey: ["finance-ap-aging", companyId] });
  };
  const invalidateOne = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ["finance-bill", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-bill-items", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-bill-approvals", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-bill-payments", id] });
    invalidateList();
  };
  const create = useMutation({ mutationFn: apApi.createSupplierBill, onSuccess: invalidateList });
  const addItem = useMutation({ mutationFn: apApi.addSupplierBillItem, onSuccess: (_d, vars) => invalidateOne(vars.supplierBillId) });
  const deleteItem = useMutation({
    mutationFn: (input: { id: string; billId: string }) => apApi.deleteSupplierBillItem(input.id),
    onSuccess: (_d, vars) => invalidateOne(vars.billId),
  });
  const submit = useMutation({ mutationFn: apApi.submitSupplierBill, onSuccess: (_d, id) => invalidateOne(id) });
  const decideApproval = useMutation({
    mutationFn: (input: { approvalId: string; billId: string; decision: "APPROVED" | "REJECTED"; comments?: string }) =>
      apApi.decideSupplierBillApproval(input.approvalId, input.decision, input.comments),
    onSuccess: (_d, vars) => invalidateOne(vars.billId),
  });
  const voidBill = useMutation({
    mutationFn: (input: { id: string; reason?: string }) => apApi.voidSupplierBill(input.id, input.reason),
    onSuccess: (_d, vars) => invalidateOne(vars.id),
  });
  const recordPayment = useMutation({
    mutationFn: apApi.recordSupplierPayment,
    onSuccess: (_d, vars) => invalidateOne(vars.supplierBillId),
  });
  return { create, addItem, deleteItem, submit, decideApproval, voidBill, recordPayment };
}

// ---------------------------------------------------------------------
// Accounts Receivable
// ---------------------------------------------------------------------
export function useCustomers(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-customers", companyId], queryFn: () => arApi.listCustomers(companyId!), enabled: !!companyId });
}

export function useCustomerMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-customers", companyId] });
  const create = useMutation({ mutationFn: arApi.createCustomer, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof arApi.updateCustomer>[1] }) => arApi.updateCustomer(input.id, input.patch),
    onSuccess: invalidate,
  });
  return { create, update };
}

export function useCustomerInvoices(companyId: string | undefined, filters: CustomerInvoiceFilters = {}) {
  return useQuery({ queryKey: ["finance-invoices", companyId, filters], queryFn: () => arApi.listCustomerInvoices(companyId!, filters), enabled: !!companyId });
}

export function useCustomerInvoice(id: string | undefined) {
  return useQuery({ queryKey: ["finance-invoice", id], queryFn: () => arApi.getCustomerInvoice(id!), enabled: !!id });
}

export function useCustomerInvoiceItems(invoiceId: string | undefined) {
  return useQuery({ queryKey: ["finance-invoice-items", invoiceId], queryFn: () => arApi.getCustomerInvoiceItems(invoiceId!), enabled: !!invoiceId });
}

export function useCustomerInvoicePayments(invoiceId: string | undefined) {
  return useQuery({ queryKey: ["finance-invoice-payments", invoiceId], queryFn: () => arApi.listCustomerPayments(invoiceId!), enabled: !!invoiceId });
}

export function useArAging(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-ar-aging", companyId], queryFn: () => arApi.getArAging(companyId!), enabled: !!companyId });
}

export function useCustomerInvoiceMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateList = () => {
    queryClient.invalidateQueries({ queryKey: ["finance-invoices", companyId] });
    queryClient.invalidateQueries({ queryKey: ["finance-ar-aging", companyId] });
  };
  const invalidateOne = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ["finance-invoice", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-invoice-items", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-invoice-payments", id] });
    invalidateList();
  };
  const create = useMutation({ mutationFn: arApi.createCustomerInvoice, onSuccess: invalidateList });
  const addItem = useMutation({ mutationFn: arApi.addCustomerInvoiceItem, onSuccess: (_d, vars) => invalidateOne(vars.customerInvoiceId) });
  const deleteItem = useMutation({
    mutationFn: (input: { id: string; invoiceId: string }) => arApi.deleteCustomerInvoiceItem(input.id),
    onSuccess: (_d, vars) => invalidateOne(vars.invoiceId),
  });
  const send = useMutation({ mutationFn: arApi.sendCustomerInvoice, onSuccess: (_d, id) => invalidateOne(id) });
  const cancel = useMutation({ mutationFn: arApi.cancelCustomerInvoice, onSuccess: (_d, id) => invalidateOne(id) });
  const voidInvoice = useMutation({
    mutationFn: (input: { id: string; reason: string }) => arApi.voidCustomerInvoice(input.id, input.reason),
    onSuccess: (_d, vars) => invalidateOne(vars.id),
  });
  const recordPayment = useMutation({
    mutationFn: arApi.recordCustomerPayment,
    onSuccess: (_d, vars) => invalidateOne(vars.customerInvoiceId),
  });
  return { create, addItem, deleteItem, send, cancel, voidInvoice, recordPayment };
}

// ---------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------
export function useExpenses(companyId: string | undefined, filters: ExpenseFilters = {}) {
  return useQuery({ queryKey: ["finance-expenses", companyId, filters], queryFn: () => expensesApi.listExpenses(companyId!, filters), enabled: !!companyId });
}

export function useExpense(id: string | undefined) {
  return useQuery({ queryKey: ["finance-expense", id], queryFn: () => expensesApi.getExpense(id!), enabled: !!id });
}

export function useExpenseApprovals(expenseId: string | undefined) {
  return useQuery({ queryKey: ["finance-expense-approvals", expenseId], queryFn: () => expensesApi.listExpenseApprovals(expenseId!), enabled: !!expenseId });
}

export function useExpenseMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["finance-expenses", companyId] });
  const invalidateOne = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ["finance-expense", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-expense-approvals", id] });
    invalidateList();
  };
  const create = useMutation({ mutationFn: expensesApi.createExpense, onSuccess: invalidateList });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof expensesApi.updateExpense>[1] }) => expensesApi.updateExpense(input.id, input.patch),
    onSuccess: (_d, vars) => invalidateOne(vars.id),
  });
  const remove = useMutation({ mutationFn: expensesApi.deleteExpense, onSuccess: invalidateList });
  const submit = useMutation({ mutationFn: expensesApi.submitExpense, onSuccess: (_d, id) => invalidateOne(id) });
  const decideApproval = useMutation({
    mutationFn: (input: { approvalId: string; expenseId: string; decision: "APPROVED" | "REJECTED"; comments?: string }) =>
      expensesApi.decideExpenseApproval(input.approvalId, input.decision, input.comments),
    onSuccess: (_d, vars) => invalidateOne(vars.expenseId),
  });
  const cancel = useMutation({ mutationFn: expensesApi.cancelExpense, onSuccess: (_d, id) => invalidateOne(id) });
  const pay = useMutation({
    mutationFn: (input: { id: string; cashAccountId: string }) => expensesApi.payExpense(input.id, input.cashAccountId),
    onSuccess: (_d, vars) => invalidateOne(vars.id),
  });
  const uploadReceipt = useMutation({
    mutationFn: (input: { companyId: string; expenseId: string; file: File }) => expensesApi.uploadExpenseReceipt(input.companyId, input.expenseId, input.file),
  });
  return { create, update, remove, submit, decideApproval, cancel, pay, uploadReceipt };
}

// ---------------------------------------------------------------------
// Cash & Bank
// ---------------------------------------------------------------------
export function useCashAccounts(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-cash-accounts", companyId], queryFn: () => cashBankApi.listCashAccounts(companyId!), enabled: !!companyId });
}

export function useBankTransactions(cashAccountId: string | undefined, filters: BankTransactionFilters = {}) {
  return useQuery({
    queryKey: ["finance-bank-transactions", cashAccountId, filters],
    queryFn: () => cashBankApi.listBankTransactions(cashAccountId!, filters),
    enabled: !!cashAccountId,
  });
}

export function useBankReconciliations(cashAccountId: string | undefined) {
  return useQuery({ queryKey: ["finance-reconciliations", cashAccountId], queryFn: () => cashBankApi.listBankReconciliations(cashAccountId!), enabled: !!cashAccountId });
}

export function useCashBankMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateAccounts = () => queryClient.invalidateQueries({ queryKey: ["finance-cash-accounts", companyId] });
  const invalidateTransactions = (cashAccountId: string) => {
    queryClient.invalidateQueries({ queryKey: ["finance-bank-transactions", cashAccountId] });
    invalidateAccounts();
  };
  const createAccount = useMutation({ mutationFn: cashBankApi.createCashAccount, onSuccess: invalidateAccounts });
  const updateAccount = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof cashBankApi.updateCashAccount>[1] }) => cashBankApi.updateCashAccount(input.id, input.patch),
    onSuccess: invalidateAccounts,
  });
  const recordTransaction = useMutation({
    mutationFn: cashBankApi.recordBankTransaction,
    onSuccess: (_d, vars) => invalidateTransactions(vars.cashAccountId),
  });
  const createReconciliation = useMutation({
    mutationFn: cashBankApi.createBankReconciliation,
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["finance-reconciliations", vars.cashAccountId] }),
  });
  const markReconciled = useMutation({
    mutationFn: (input: { transactionIds: string[]; reconciliationId: string; cashAccountId: string }) =>
      cashBankApi.markTransactionsReconciled(input.transactionIds, input.reconciliationId),
    onSuccess: (_d, vars) => invalidateTransactions(vars.cashAccountId),
  });
  const completeReconciliation = useMutation({
    mutationFn: (input: { id: string; cashAccountId: string }) => cashBankApi.completeBankReconciliation(input.id),
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: ["finance-reconciliations", vars.cashAccountId] }),
  });
  return { createAccount, updateAccount, recordTransaction, createReconciliation, markReconciled, completeReconciliation };
}

// ---------------------------------------------------------------------
// Tax
// ---------------------------------------------------------------------
export function useTaxRates(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-tax-rates", companyId], queryFn: () => taxApi.listTaxRates(companyId!), enabled: !!companyId });
}

export function useTaxSummary(companyId: string | undefined, startDate: string | undefined, endDate: string | undefined) {
  return useQuery({
    queryKey: ["finance-tax-summary", companyId, startDate, endDate],
    queryFn: () => taxApi.getTaxSummary(companyId!, startDate!, endDate!),
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useTaxRateMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["finance-tax-rates", companyId] });
  const create = useMutation({ mutationFn: taxApi.createTaxRate, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof taxApi.updateTaxRate>[1] }) => taxApi.updateTaxRate(input.id, input.patch),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: taxApi.deleteTaxRate, onSuccess: invalidate });
  return { create, update, remove };
}

// ---------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------
export function usePayrollRuns(companyId: string | undefined) {
  return useQuery({ queryKey: ["finance-payroll-runs", companyId], queryFn: () => payrollApi.listPayrollRuns(companyId!), enabled: !!companyId });
}

export function usePayrollRun(id: string | undefined) {
  return useQuery({ queryKey: ["finance-payroll-run", id], queryFn: () => payrollApi.getPayrollRun(id!), enabled: !!id });
}

export function usePayrollItems(payrollRunId: string | undefined) {
  return useQuery({ queryKey: ["finance-payroll-items", payrollRunId], queryFn: () => payrollApi.listPayrollItems(payrollRunId!), enabled: !!payrollRunId });
}

export function usePayrollMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["finance-payroll-runs", companyId] });
  const invalidateOne = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ["finance-payroll-run", id] });
    queryClient.invalidateQueries({ queryKey: ["finance-payroll-items", id] });
    invalidateList();
  };
  const generate = useMutation({
    mutationFn: (input: { payrollPeriodId: string; runType?: "REGULAR" | "THIRTEENTH_MONTH" }) =>
      payrollApi.generatePayrollRun(input.payrollPeriodId, input.runType),
    onSuccess: invalidateList,
  });
  const updateItem = useMutation({
    mutationFn: (input: { id: string; runId: string; patch: Parameters<typeof payrollApi.updatePayrollItem>[1] }) =>
      payrollApi.updatePayrollItem(input.id, input.patch),
    onSuccess: (_d, vars) => invalidateOne(vars.runId),
  });
  const calculateItem = useMutation({
    mutationFn: (input: { id: string; runId: string }) => payrollApi.calculatePayrollItem(input.id),
    onSuccess: (_d, vars) => invalidateOne(vars.runId),
  });
  const recalculateTotals = useMutation({ mutationFn: payrollApi.recalculatePayrollRunTotals, onSuccess: (_d, id) => invalidateOne(id) });
  const approve = useMutation({ mutationFn: payrollApi.approvePayrollRun, onSuccess: (_d, id) => invalidateOne(id) });
  const pay = useMutation({
    mutationFn: (input: { id: string; cashAccountId: string }) => payrollApi.payPayrollRun(input.id, input.cashAccountId),
    onSuccess: (_d, vars) => invalidateOne(vars.id),
  });
  return { generate, updateItem, calculateItem, recalculateTotals, approve, pay };
}

// ---------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------
export function useProfitAndLoss(companyId: string | undefined, startDate: string | undefined, endDate: string | undefined) {
  return useQuery({
    queryKey: ["finance-pnl", companyId, startDate, endDate],
    queryFn: () => reportsApi.getProfitAndLoss(companyId!, startDate!, endDate!),
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useBalanceSheet(companyId: string | undefined, asOfDate: string | undefined) {
  return useQuery({
    queryKey: ["finance-balance-sheet", companyId, asOfDate],
    queryFn: () => reportsApi.getBalanceSheet(companyId!, asOfDate!),
    enabled: !!companyId && !!asOfDate,
  });
}

export function useCashFlow(companyId: string | undefined, startDate: string | undefined, endDate: string | undefined) {
  return useQuery({
    queryKey: ["finance-cash-flow", companyId, startDate, endDate],
    queryFn: () => reportsApi.getCashFlow(companyId!, startDate!, endDate!),
    enabled: !!companyId && !!startDate && !!endDate,
  });
}
