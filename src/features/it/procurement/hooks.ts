import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as currencyApi from "@/features/it/procurement/currencyApi";
import * as budgetApi from "@/features/it/procurement/budgetApi";
import * as procurementApi from "@/features/it/procurement/procurementApi";
import type { PurchaseRequestFilters, PurchaseOrderFilters } from "@/features/it/procurement/procurementApi";
import type { BudgetModuleKey } from "@/types/database";

// ---------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------
export function useCurrencies() {
  return useQuery({ queryKey: ["currencies"], queryFn: () => currencyApi.listCurrencies() });
}

export function useCompanyCurrencySettings(companyId: string | undefined) {
  return useQuery({
    queryKey: ["company-currency-settings", companyId],
    queryFn: () => currencyApi.getCompanyCurrencySettings(companyId!),
    enabled: !!companyId,
  });
}

export function useCurrencyMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const updateBaseCurrency = useMutation({
    mutationFn: (currencyId: string) => currencyApi.updateCompanyBaseCurrency(companyId!, currencyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-currency-settings", companyId] }),
  });
  return { updateBaseCurrency };
}

export function useExchangeRates() {
  return useQuery({ queryKey: ["exchange-rates"], queryFn: () => currencyApi.listExchangeRates() });
}

export function useExchangeRateMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
  const create = useMutation({ mutationFn: currencyApi.createExchangeRate, onSuccess: invalidate });
  const setActive = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) => currencyApi.setExchangeRateActive(input.id, input.isActive),
    onSuccess: invalidate,
  });
  return { create, setActive };
}

// ---------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------
export function useBudgets(companyId: string | undefined, moduleKey?: BudgetModuleKey) {
  return useQuery({
    queryKey: ["budgets", companyId, moduleKey],
    queryFn: () => budgetApi.listBudgets(companyId!, moduleKey),
    enabled: !!companyId,
  });
}

export function useBudgetsPendingFinance(companyId: string | undefined) {
  return useQuery({
    queryKey: ["budgets-pending-finance", companyId],
    queryFn: () => budgetApi.listBudgetsPendingFinance(companyId!),
    enabled: !!companyId,
  });
}

export function useBudgetLines(budgetId: string | undefined) {
  return useQuery({ queryKey: ["budget-lines", budgetId], queryFn: () => budgetApi.listBudgetLines(budgetId!), enabled: !!budgetId });
}

export function useBudgetHistory(budgetId: string | undefined) {
  return useQuery({ queryKey: ["budget-history", budgetId], queryFn: () => budgetApi.listBudgetHistory(budgetId!), enabled: !!budgetId });
}

export function useBudgetRevisions(budgetId: string | undefined) {
  return useQuery({ queryKey: ["budget-revisions", budgetId], queryFn: () => budgetApi.listBudgetRevisions(budgetId!), enabled: !!budgetId });
}

export function useBudget(budgetId: string | undefined) {
  return useQuery({ queryKey: ["budget", budgetId], queryFn: () => budgetApi.getBudget(budgetId!), enabled: !!budgetId });
}

export function useBudgetCategories(companyId: string | undefined) {
  return useQuery({ queryKey: ["budget-categories", companyId], queryFn: () => budgetApi.listBudgetCategories(companyId!), enabled: !!companyId });
}

export function useBudgetCategorySummaries(budgetId: string | undefined) {
  return useQuery({
    queryKey: ["budget-category-summaries", budgetId],
    queryFn: () => budgetApi.listBudgetCategorySummaries(budgetId!),
    enabled: !!budgetId,
  });
}

export function useBudgetTransactions(budgetId: string | undefined) {
  return useQuery({ queryKey: ["budget-transactions", budgetId], queryFn: () => budgetApi.listBudgetTransactions(budgetId!), enabled: !!budgetId });
}

export function useAllBudgetTransactions(companyId: string | undefined) {
  return useQuery({ queryKey: ["all-budget-transactions", companyId], queryFn: () => budgetApi.listAllBudgetTransactions(companyId!), enabled: !!companyId });
}

export function useBudgetMutations(budgetId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["budgets-pending-finance"] });
    queryClient.invalidateQueries({ queryKey: ["budget-categories"] });
    if (budgetId) {
      queryClient.invalidateQueries({ queryKey: ["budget", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budget-category-summaries", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budget-transactions", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budget-lines", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budget-history", budgetId] });
      queryClient.invalidateQueries({ queryKey: ["budget-revisions", budgetId] });
    }
  };
  const create = useMutation({ mutationFn: budgetApi.createBudget, onSuccess: invalidate });
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof budgetApi.updateBudget>[1] }) => budgetApi.updateBudget(input.id, input.patch),
    onSuccess: invalidate,
  });
  const createCategory = useMutation({
    mutationFn: (input: { companyId: string; name: string; description?: string | null }) => budgetApi.createBudgetCategory(input.companyId, input.name, input.description),
    onSuccess: invalidate,
  });
  const setAllocation = useMutation({ mutationFn: budgetApi.upsertBudgetAllocation, onSuccess: invalidate });
  const createAdjustment = useMutation({ mutationFn: budgetApi.createBudgetAdjustment, onSuccess: invalidate });

  const createLine = useMutation({ mutationFn: budgetApi.createBudgetLine, onSuccess: invalidate });
  const updateLine = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof budgetApi.updateBudgetLine>[1] }) => budgetApi.updateBudgetLine(input.id, input.patch),
    onSuccess: invalidate,
  });
  const deleteLine = useMutation({ mutationFn: budgetApi.deleteBudgetLine, onSuccess: invalidate });

  const submitToFinance = useMutation({
    mutationFn: (input: { budgetId: string; comments?: string | null }) => budgetApi.submitBudgetToFinance(input.budgetId, input.comments),
    onSuccess: invalidate,
  });
  const beginReview = useMutation({ mutationFn: budgetApi.beginBudgetFinanceReview, onSuccess: invalidate });
  const returnForRevision = useMutation({
    mutationFn: (input: { budgetId: string; reason: string }) => budgetApi.returnBudgetForRevision(input.budgetId, input.reason),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (input: { budgetId: string; reason: string }) => budgetApi.rejectBudget(input.budgetId, input.reason),
    onSuccess: invalidate,
  });
  const approve = useMutation({
    mutationFn: (input: { budgetId: string; lineApprovals?: { budgetLineId: string; approvedAmount: number }[]; comments?: string | null }) =>
      budgetApi.approveBudget(input.budgetId, input.lineApprovals, input.comments),
    onSuccess: invalidate,
  });
  const activate = useMutation({ mutationFn: budgetApi.activateBudget, onSuccess: invalidate });
  const close = useMutation({ mutationFn: budgetApi.closeBudget, onSuccess: invalidate });
  const cancel = useMutation({
    mutationFn: (input: { budgetId: string; reason?: string | null }) => budgetApi.cancelBudget(input.budgetId, input.reason),
    onSuccess: invalidate,
  });
  const requestIncrease = useMutation({
    mutationFn: (input: { budgetId: string; additionalAmount: number; reason: string }) =>
      budgetApi.requestBudgetIncrease(input.budgetId, input.additionalAmount, input.reason),
    onSuccess: invalidate,
  });
  const decideRevision = useMutation({
    mutationFn: (input: { revisionId: string; decision: "APPROVED" | "REJECTED"; comments?: string | null }) =>
      budgetApi.decideBudgetRevision(input.revisionId, input.decision, input.comments),
    onSuccess: invalidate,
  });

  return {
    create, update, createCategory, setAllocation, createAdjustment,
    createLine, updateLine, deleteLine,
    submitToFinance, beginReview, returnForRevision, reject, approve, activate, close, cancel,
    requestIncrease, decideRevision,
  };
}

// ---------------------------------------------------------------------
// Purchase Requests
// ---------------------------------------------------------------------
export function usePurchaseRequests(companyId: string | undefined, filters: PurchaseRequestFilters, userId?: string) {
  return useQuery({
    queryKey: ["purchase-requests", companyId, filters, userId],
    queryFn: () => procurementApi.listPurchaseRequests(companyId!, filters, userId),
    enabled: !!companyId,
  });
}

export function usePurchaseRequest(id: string | undefined) {
  return useQuery({ queryKey: ["purchase-request", id], queryFn: () => procurementApi.getPurchaseRequest(id!), enabled: !!id });
}

export function usePurchaseRequestMutations(id?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    if (id) queryClient.invalidateQueries({ queryKey: ["purchase-request", id] });
  };
  const create = useMutation({ mutationFn: procurementApi.createPurchaseRequest, onSuccess: invalidate });
  const submit = useMutation({ mutationFn: procurementApi.submitPurchaseRequest, onSuccess: invalidate });
  const decideApproval = useMutation({
    mutationFn: (input: { approvalId: string; decision: "APPROVED" | "REJECTED"; comments?: string | null }) =>
      procurementApi.decidePurchaseRequestApproval(input.approvalId, input.decision, input.comments),
    onSuccess: invalidate,
  });
  return { create, submit, decideApproval };
}

// ---------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------
export function useQuotationMutations(purchaseRequestId?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    if (purchaseRequestId) queryClient.invalidateQueries({ queryKey: ["purchase-request", purchaseRequestId] });
  };
  const create = useMutation({ mutationFn: procurementApi.createQuotation, onSuccess: invalidate });
  const select = useMutation({
    mutationFn: (input: { quotationId: string; reason?: string | null }) => procurementApi.selectQuotation(input.quotationId, input.reason),
    onSuccess: invalidate,
  });
  return { create, select };
}

export function useQuotations(companyId: string | undefined) {
  return useQuery({ queryKey: ["quotations", companyId], queryFn: () => procurementApi.listQuotations(companyId!), enabled: !!companyId });
}

export function useQuotationItems(quotationId: string | undefined) {
  return useQuery({
    queryKey: ["quotation-items", quotationId],
    queryFn: () => procurementApi.getQuotationItems(quotationId!),
    enabled: !!quotationId,
  });
}

// ---------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------
export function usePurchaseOrders(companyId: string | undefined, filters: PurchaseOrderFilters = {}) {
  return useQuery({
    queryKey: ["purchase-orders", companyId, filters],
    queryFn: () => procurementApi.listPurchaseOrders(companyId!, filters),
    enabled: !!companyId,
  });
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({ queryKey: ["purchase-order", id], queryFn: () => procurementApi.getPurchaseOrder(id!), enabled: !!id });
}

export function usePurchaseOrderMutations(id?: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    if (id) queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
  };
  const createFromPR = useMutation({ mutationFn: procurementApi.createPurchaseOrderFromPR, onSuccess: invalidate });
  const decideApproval = useMutation({
    mutationFn: (input: { approvalId: string; decision: "APPROVED" | "REJECTED"; comments?: string | null }) =>
      procurementApi.decidePurchaseOrderApproval(input.approvalId, input.decision, input.comments),
    onSuccess: invalidate,
  });
  const updateStatus = useMutation({
    mutationFn: (input: { poId: string; status: string }) => procurementApi.updatePurchaseOrderStatus(input.poId, input.status),
    onSuccess: invalidate,
  });
  const receiveDelivery = useMutation({ mutationFn: procurementApi.createDelivery, onSuccess: invalidate });
  return { createFromPR, decideApproval, updateStatus, receiveDelivery };
}

export function useDeliveries(companyId: string | undefined) {
  return useQuery({ queryKey: ["deliveries", companyId], queryFn: () => procurementApi.listDeliveries(companyId!), enabled: !!companyId });
}

// ---------------------------------------------------------------------
// History / dashboard / suppliers
// ---------------------------------------------------------------------
export function useProcurementHistory(companyId: string | undefined) {
  return useQuery({ queryKey: ["procurement-history", companyId], queryFn: () => procurementApi.listProcurementHistory(companyId!), enabled: !!companyId });
}

export function useProcurementDashboardStats(companyId: string | undefined) {
  return useQuery({ queryKey: ["procurement-dashboard-stats", companyId], queryFn: () => procurementApi.getProcurementDashboardStats(companyId!), enabled: !!companyId });
}

export function useSupplierDetail(supplierId: string | undefined) {
  return useQuery({ queryKey: ["supplier-detail", supplierId], queryFn: () => procurementApi.getSupplierDetail(supplierId!), enabled: !!supplierId });
}

export function useSupplierMutations() {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (input: { id: string; patch: Parameters<typeof procurementApi.updateSupplier>[1] }) => procurementApi.updateSupplier(input.id, input.patch),
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-detail", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
  return { update };
}
