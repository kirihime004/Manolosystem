import { supabase } from "@/lib/supabase/client";
import type { Budget, BudgetSummary, BudgetCategory, BudgetAllocation, BudgetCategorySummary, BudgetTransaction, BudgetAlertThreshold } from "@/types/database";

export async function listBudgets(companyId: string): Promise<BudgetSummary[]> {
  const { data, error } = await supabase
    .from("v_budget_summary")
    .select("*")
    .eq("company_id", companyId)
    .order("fiscal_year", { ascending: false });
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
  budgetName: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  currencyId: string;
  totalBudget: number;
  description?: string | null;
}): Promise<Budget> {
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      company_id: input.companyId,
      budget_name: input.budgetName,
      fiscal_year: input.fiscalYear,
      start_date: input.startDate,
      end_date: input.endDate,
      currency_id: input.currencyId,
      total_budget: input.totalBudget,
      description: input.description ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Budget;
}

export async function updateBudget(id: string, patch: Partial<{ budgetName: string; totalBudget: number; description: string | null; status: string }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.budgetName !== undefined) fields.budget_name = patch.budgetName;
  if (patch.totalBudget !== undefined) fields.total_budget = patch.totalBudget;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.status !== undefined) fields.status = patch.status;
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
