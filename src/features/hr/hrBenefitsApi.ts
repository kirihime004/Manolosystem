import { supabase } from "@/lib/supabase/client";
import type { EmployeeBenefit, EmployeeDeduction, BenefitType, DeductionType } from "@/types/database";

export async function listAllBenefits(companyId: string): Promise<(EmployeeBenefit & { employees: { first_name: string; last_name: string; employee_number: string } })[]> {
  const { data, error } = await supabase.from("employee_benefits").select("*, employees!inner(first_name, last_name, employee_number)").eq("company_id", companyId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as unknown as (EmployeeBenefit & { employees: { first_name: string; last_name: string; employee_number: string } })[];
}

export async function listAllDeductions(companyId: string): Promise<(EmployeeDeduction & { employees: { first_name: string; last_name: string; employee_number: string } })[]> {
  const { data, error } = await supabase.from("employee_deductions").select("*, employees!inner(first_name, last_name, employee_number)").eq("company_id", companyId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as unknown as (EmployeeDeduction & { employees: { first_name: string; last_name: string; employee_number: string } })[];
}

export async function listBenefits(employeeId: string): Promise<EmployeeBenefit[]> {
  const { data, error } = await supabase.from("employee_benefits").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as EmployeeBenefit[];
}

export async function createBenefit(input: {
  companyId: string; employeeId: string; benefitType: BenefitType; provider?: string | null;
  startDate?: string | null; endDate?: string | null; amount?: number | null; currencyId?: string | null;
  frequency?: string | null; notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("employee_benefits").insert({
    company_id: input.companyId, employee_id: input.employeeId, benefit_type: input.benefitType,
    provider: input.provider ?? null, start_date: input.startDate ?? null, end_date: input.endDate ?? null,
    amount: input.amount ?? null, currency_id: input.currencyId ?? null, frequency: input.frequency ?? null, notes: input.notes ?? null,
  });
  if (error) throw error;
}

export async function updateBenefitStatus(id: string, status: EmployeeBenefit["status"]): Promise<void> {
  const { error } = await supabase.from("employee_benefits").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function listDeductions(employeeId: string): Promise<EmployeeDeduction[]> {
  const { data, error } = await supabase.from("employee_deductions").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as EmployeeDeduction[];
}

export async function createDeduction(input: {
  companyId: string; employeeId: string; deductionType: DeductionType; description?: string | null;
  amount: number; currencyId?: string | null; frequency?: string | null; startDate?: string | null; endDate?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("employee_deductions").insert({
    company_id: input.companyId, employee_id: input.employeeId, deduction_type: input.deductionType,
    description: input.description ?? null, amount: input.amount, currency_id: input.currencyId ?? null,
    frequency: input.frequency ?? null, start_date: input.startDate ?? null, end_date: input.endDate ?? null,
  });
  if (error) throw error;
}

export async function updateDeductionStatus(id: string, status: EmployeeDeduction["status"]): Promise<void> {
  const { error } = await supabase.from("employee_deductions").update({ status }).eq("id", id);
  if (error) throw error;
}
