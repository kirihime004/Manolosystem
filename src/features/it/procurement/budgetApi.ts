import { supabase } from "@/lib/supabase/client";
import type {
  Budget, BudgetSummary, BudgetCategory, BudgetAllocation, BudgetCategorySummary, BudgetTransaction,
  BudgetAlertThreshold, BudgetLine, BudgetHistoryEvent, BudgetRevision, BudgetModuleKey,
} from "@/types/database";

// moduleKey filters to one department's budgets (the shared engine is one
// table -- department screens are filtered views, per the architecture
// correction). Omit it for Finance's cross-department views.
export async function listBudgets(companyId: string, moduleKey?: BudgetModuleKey): Promise<BudgetSummary[]> {
  let query = supabase.from("v_budget_summary").select("*").eq("company_id", companyId).order("fiscal_year", { ascending: false });
  if (moduleKey) query = query.eq("module_key", moduleKey);
  const { data, error } = await query;
  if (error) throw error;
  return data as BudgetSummary[];
}

// The Finance review queue: budgets currently sitting with Finance,
// across every department.
export async function listBudgetsPendingFinance(companyId: string): Promise<BudgetSummary[]> {
  const { data, error } = await supabase
    .from("v_budget_summary")
    .select("*")
    .eq("company_id", companyId)
    .in("status", ["SUBMITTED_TO_FINANCE", "FINANCE_REVIEW"])
    .order("submitted_at", { ascending: true });
  if (error) throw error;
  return data as BudgetSummary[];
}

export async function getBudget(budgetId: string): Promise<BudgetSummary | null> {
  const { data, error } = await supabase.from("v_budget_summary").select("*").eq("id", budgetId).maybeSingle();
  if (error) throw error;
  return data as BudgetSummary | null;
}

export async function createBudget(input: {
  companyId: string;
  moduleKey: BudgetModuleKey;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  budgetName: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  currencyId: string;
  description?: string | null;
  notes?: string | null;
}): Promise<Budget> {
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      company_id: input.companyId,
      module_key: input.moduleKey,
      department_id: input.departmentId ?? null,
      cost_center_id: input.costCenterId ?? null,
      project_id: input.projectId ?? null,
      budget_name: input.budgetName,
      fiscal_year: input.fiscalYear,
      start_date: input.startDate,
      end_date: input.endDate,
      currency_id: input.currencyId,
      total_budget: 0,
      description: input.description ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Budget;
}

export async function updateBudget(id: string, patch: Partial<{ budgetName: string; description: string | null; notes: string | null }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.budgetName !== undefined) fields.budget_name = patch.budgetName;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  const { error } = await supabase.from("budgets").update(fields).eq("id", id);
  if (error) throw error;
}

export async function listBudgetCategories(companyId: string): Promise<BudgetCategory[]> {
  const { data, error } = await supabase.from("budget_categories").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as BudgetCategory[];
}

export async function createBudgetCategory(companyId: string, name: string, description?: string | null): Promise<BudgetCategory> {
  const { data, error } = await supabase
    .from("budget_categories")
    .insert({ company_id: companyId, name, description: description ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as BudgetCategory;
}

export async function listBudgetCategorySummaries(budgetId: string): Promise<BudgetCategorySummary[]> {
  const { data, error } = await supabase.from("v_budget_category_summary").select("*").eq("budget_id", budgetId);
  if (error) throw error;
  return data as BudgetCategorySummary[];
}

export async function upsertBudgetAllocation(input: { companyId: string; budgetId: string; categoryId: string; allocatedAmount: number }): Promise<BudgetAllocation> {
  const { data: existing } = await supabase
    .from("budget_allocations")
    .select("id")
    .eq("budget_id", input.budgetId)
    .eq("category_id", input.categoryId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("budget_allocations")
      .update({ allocated_amount: input.allocatedAmount })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as BudgetAllocation;
  }

  const { data, error } = await supabase
    .from("budget_allocations")
    .insert({ company_id: input.companyId, budget_id: input.budgetId, category_id: input.categoryId, allocated_amount: input.allocatedAmount })
    .select("*")
    .single();
  if (error) throw error;
  return data as BudgetAllocation;
}

export async function listAllBudgetTransactions(companyId: string): Promise<(BudgetTransaction & { budget: Pick<Budget, "budget_name"> | null })[]> {
  const { data, error } = await supabase
    .from("budget_transactions")
    .select("*, budget:budgets(budget_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as (BudgetTransaction & { budget: Pick<Budget, "budget_name"> | null })[];
}

export async function listBudgetTransactions(budgetId: string): Promise<BudgetTransaction[]> {
  const { data, error } = await supabase
    .from("budget_transactions")
    .select("*")
    .eq("budget_id", budgetId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as BudgetTransaction[];
}

export async function checkBudgetAvailability(budgetId: string, categoryId: string | null, amount: number, currencyId: string) {
  const { data, error } = await supabase.rpc("check_budget_availability", {
    p_budget_id: budgetId,
    p_category_id: categoryId,
    p_amount: amount,
    p_currency_id: currencyId,
  });
  if (error) throw error;
  return (data as { is_available: boolean; available_amount: number; converted_amount: number }[])[0];
}

export async function createBudgetAdjustment(input: {
  budgetId: string;
  categoryId: string | null;
  amount: number;
  currencyId: string;
  type: "ADJUSTMENT" | "REFUND";
  sign?: 1 | -1;
  description?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_budget_adjustment", {
    p_budget_id: input.budgetId,
    p_category_id: input.categoryId,
    p_amount: input.amount,
    p_currency_id: input.currencyId,
    p_type: input.type,
    p_sign: input.sign ?? 1,
    p_description: input.description ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listBudgetAlertThresholds(companyId: string): Promise<BudgetAlertThreshold[]> {
  const { data, error } = await supabase.from("budget_alert_thresholds").select("*").eq("company_id", companyId).order("threshold_percent");
  if (error) throw error;
  return data as BudgetAlertThreshold[];
}

// ---------------------------------------------------------------------
// Budget lines -- the real line-item proposal a department prepares.
// Only writable while the parent budget is still editable (enforced
// server-side by lock_budget_lines()).
// ---------------------------------------------------------------------
export async function listBudgetLines(budgetId: string): Promise<BudgetLine[]> {
  const { data, error } = await supabase.from("budget_lines").select("*").eq("budget_id", budgetId).order("created_at");
  if (error) throw error;
  return data as BudgetLine[];
}

export async function createBudgetLine(input: {
  companyId: string;
  budgetId: string;
  moduleKey: BudgetModuleKey;
  categoryId?: string | null;
  description: string;
  departmentId?: string | null;
  costCenterId?: string | null;
  projectId?: string | null;
  quantity?: number;
  unitCost?: number;
  requestedAmount: number;
  currencyId?: string | null;
  notes?: string | null;
}): Promise<BudgetLine> {
  const { data, error } = await supabase
    .from("budget_lines")
    .insert({
      company_id: input.companyId, budget_id: input.budgetId, module_key: input.moduleKey,
      category_id: input.categoryId ?? null, description: input.description,
      department_id: input.departmentId ?? null, cost_center_id: input.costCenterId ?? null, project_id: input.projectId ?? null,
      quantity: input.quantity ?? 1, unit_cost: input.unitCost ?? 0, requested_amount: input.requestedAmount,
      currency_id: input.currencyId ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as BudgetLine;
}

export async function updateBudgetLine(id: string, patch: Partial<{
  categoryId: string | null; description: string; quantity: number; unitCost: number; requestedAmount: number; notes: string | null;
}>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) fields.category_id = patch.categoryId;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.quantity !== undefined) fields.quantity = patch.quantity;
  if (patch.unitCost !== undefined) fields.unit_cost = patch.unitCost;
  if (patch.requestedAmount !== undefined) fields.requested_amount = patch.requestedAmount;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  const { error } = await supabase.from("budget_lines").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteBudgetLine(id: string): Promise<void> {
  const { error } = await supabase.from("budget_lines").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Workflow RPCs
// ---------------------------------------------------------------------
export async function submitBudgetToFinance(budgetId: string, comments?: string | null): Promise<void> {
  const { error } = await supabase.rpc("submit_budget_to_finance", { p_budget_id: budgetId, p_comments: comments ?? null });
  if (error) throw error;
}

export async function beginBudgetFinanceReview(budgetId: string): Promise<void> {
  const { error } = await supabase.rpc("begin_budget_finance_review", { p_budget_id: budgetId });
  if (error) throw error;
}

export async function returnBudgetForRevision(budgetId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("return_budget_for_revision", { p_budget_id: budgetId, p_reason: reason });
  if (error) throw error;
}

export async function rejectBudget(budgetId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("reject_budget", { p_budget_id: budgetId, p_reason: reason });
  if (error) throw error;
}

export async function approveBudget(budgetId: string, lineApprovals?: { budgetLineId: string; approvedAmount: number }[], comments?: string | null): Promise<void> {
  const { error } = await supabase.rpc("approve_budget", {
    p_budget_id: budgetId,
    p_line_approvals: lineApprovals ? lineApprovals.map((l) => ({ budget_line_id: l.budgetLineId, approved_amount: l.approvedAmount })) : null,
    p_comments: comments ?? null,
  });
  if (error) throw error;
}

export async function activateBudget(budgetId: string): Promise<void> {
  const { error } = await supabase.rpc("activate_budget", { p_budget_id: budgetId });
  if (error) throw error;
}

export async function closeBudget(budgetId: string): Promise<void> {
  const { error } = await supabase.rpc("close_budget", { p_budget_id: budgetId });
  if (error) throw error;
}

export async function cancelBudget(budgetId: string, reason?: string | null): Promise<void> {
  const { error } = await supabase.rpc("cancel_budget", { p_budget_id: budgetId, p_reason: reason ?? null });
  if (error) throw error;
}

export async function requestBudgetIncrease(budgetId: string, additionalAmount: number, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc("request_budget_increase", {
    p_budget_id: budgetId, p_additional_amount: additionalAmount, p_reason: reason,
  });
  if (error) throw error;
  return data as string;
}

export async function decideBudgetRevision(revisionId: string, decision: "APPROVED" | "REJECTED", comments?: string | null): Promise<void> {
  const { error } = await supabase.rpc("decide_budget_revision", { p_revision_id: revisionId, p_decision: decision, p_comments: comments ?? null });
  if (error) throw error;
}

export async function listBudgetHistory(budgetId: string): Promise<BudgetHistoryEvent[]> {
  const { data, error } = await supabase.from("budget_history").select("*").eq("budget_id", budgetId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as BudgetHistoryEvent[];
}

export async function listBudgetRevisions(budgetId: string): Promise<BudgetRevision[]> {
  const { data, error } = await supabase.from("budget_revisions").select("*").eq("budget_id", budgetId).order("version", { ascending: false });
  if (error) throw error;
  return data as BudgetRevision[];
}
