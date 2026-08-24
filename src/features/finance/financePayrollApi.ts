import { supabase } from "@/lib/supabase/client";
import type { PayrollRun, PayrollItem } from "@/types/database";

export async function listPayrollRuns(companyId: string): Promise<PayrollRun[]> {
  const { data, error } = await supabase.from("payroll_runs").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as PayrollRun[];
}

export async function getPayrollRun(id: string): Promise<PayrollRun | null> {
  const { data, error } = await supabase.from("payroll_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as PayrollRun | null;
}

export async function listPayrollItems(payrollRunId: string): Promise<PayrollItem[]> {
  const { data, error } = await supabase.from("payroll_items").select("*").eq("payroll_run_id", payrollRunId).order("created_at");
  if (error) throw error;
  return data as PayrollItem[];
}

export async function generatePayrollRun(payrollPeriodId: string, runType: "REGULAR" | "THIRTEENTH_MONTH" = "REGULAR"): Promise<string> {
  const { data, error } = await supabase.rpc("generate_payroll_run", { p_payroll_period_id: payrollPeriodId, p_run_type: runType });
  if (error) throw error;
  return data as string;
}

export async function updatePayrollItem(id: string, patch: Partial<{ overtimePay: number; bonuses: number; otherDeductions: number; notes: string | null }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.overtimePay !== undefined) fields.overtime_pay = patch.overtimePay;
  if (patch.bonuses !== undefined) fields.bonuses = patch.bonuses;
  if (patch.otherDeductions !== undefined) fields.other_deductions = patch.otherDeductions;
  if (patch.notes !== undefined) fields.notes = patch.notes;
  const { error } = await supabase.from("payroll_items").update(fields).eq("id", id);
  if (error) throw error;
}

export async function calculatePayrollItem(id: string): Promise<void> {
  const { error } = await supabase.rpc("calculate_payroll_item", { p_payroll_item_id: id });
  if (error) throw error;
}

export async function recalculatePayrollRunTotals(payrollRunId: string): Promise<void> {
  const { error } = await supabase.rpc("recalculate_payroll_run_totals", { p_payroll_run_id: payrollRunId });
  if (error) throw error;
}

export async function approvePayrollRun(id: string): Promise<void> {
  const { error } = await supabase.rpc("approve_payroll_run", { p_payroll_run_id: id });
  if (error) throw error;
}

export async function payPayrollRun(id: string, cashAccountId: string): Promise<string> {
  const { data, error } = await supabase.rpc("pay_payroll_run", { p_payroll_run_id: id, p_cash_account_id: cashAccountId });
  if (error) throw error;
  return data as string;
}
