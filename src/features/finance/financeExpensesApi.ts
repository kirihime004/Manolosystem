import { supabase } from "@/lib/supabase/client";
import type { Expense, ExpenseApproval } from "@/types/database";

export interface ExpenseFilters {
  status?: string;
  employeeId?: string;
}

export async function listExpenses(companyId: string, filters: ExpenseFilters = {}): Promise<Expense[]> {
  let query = supabase.from("expenses").select("*").eq("company_id", companyId).order("expense_date", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
}

export async function getExpense(id: string): Promise<Expense | null> {
  const { data, error } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Expense | null;
}

export async function listExpenseApprovals(expenseId: string): Promise<ExpenseApproval[]> {
  const { data, error } = await supabase.from("expense_approvals").select("*").eq("expense_id", expenseId).order("sequence");
  if (error) throw error;
  return data as ExpenseApproval[];
}

export async function createExpense(input: {
  companyId: string;
  employeeId: string;
  departmentId?: string | null;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  currencyId: string;
  receiptPath?: string | null;
  projectId?: string | null;
  customerId?: string | null;
  costCenterId?: string | null;
  budgetId?: string | null;
  budgetCategoryId?: string | null;
}): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      company_id: input.companyId, employee_id: input.employeeId, department_id: input.departmentId ?? null,
      expense_date: input.expenseDate, category: input.category, description: input.description, amount: input.amount,
      currency_id: input.currencyId, receipt_path: input.receiptPath ?? null, project_id: input.projectId ?? null,
      customer_id: input.customerId ?? null, cost_center_id: input.costCenterId ?? null,
      budget_id: input.budgetId ?? null, budget_category_id: input.budgetCategoryId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function updateExpense(id: string, patch: Partial<{
  category: string; description: string; amount: number; currencyId: string; receiptPath: string | null;
}>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.category !== undefined) fields.category = patch.category;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.amount !== undefined) fields.amount = patch.amount;
  if (patch.currencyId !== undefined) fields.currency_id = patch.currencyId;
  if (patch.receiptPath !== undefined) fields.receipt_path = patch.receiptPath;
  const { error } = await supabase.from("expenses").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function submitExpense(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_expense", { p_expense_id: id });
  if (error) throw error;
}

export async function decideExpenseApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string): Promise<void> {
  const { error } = await supabase.rpc("decide_expense_approval", { p_approval_id: approvalId, p_decision: decision, p_comments: comments ?? null });
  if (error) throw error;
}

export async function cancelExpense(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_expense", { p_expense_id: id });
  if (error) throw error;
}

export async function payExpense(id: string, cashAccountId: string): Promise<string> {
  const { data, error } = await supabase.rpc("pay_expense", { p_expense_id: id, p_cash_account_id: cashAccountId });
  if (error) throw error;
  return data as string;
}

export async function uploadExpenseReceipt(companyId: string, expenseId: string, file: File): Promise<string> {
  const path = `${companyId}/expenses/${expenseId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("finance-documents").upload(path, file);
  if (error) throw error;
  return path;
}

export async function getFinanceDocumentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("finance-documents").createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
