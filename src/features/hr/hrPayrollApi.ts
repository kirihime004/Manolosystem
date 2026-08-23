import { supabase } from "@/lib/supabase/client";
import type { PayrollPeriod } from "@/types/database";

export async function listPayrollPeriods(companyId: string): Promise<PayrollPeriod[]> {
  const { data, error } = await supabase.from("payroll_periods").select("*").eq("company_id", companyId).order("start_date", { ascending: false });
  if (error) throw error;
  return data as PayrollPeriod[];
}

export async function createPayrollPeriod(input: {
  companyId: string; periodName: string; frequency: PayrollPeriod["frequency"]; startDate: string; endDate: string; payDate?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("payroll_periods").insert({
    company_id: input.companyId, period_name: input.periodName, frequency: input.frequency,
    start_date: input.startDate, end_date: input.endDate, pay_date: input.payDate ?? null,
  });
  if (error) throw error;
}

export async function updatePayrollPeriodStatus(id: string, status: PayrollPeriod["status"]): Promise<void> {
  const { error } = await supabase.from("payroll_periods").update({ status }).eq("id", id);
  if (error) throw error;
}
