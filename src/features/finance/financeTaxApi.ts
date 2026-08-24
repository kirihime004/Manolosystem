import { supabase } from "@/lib/supabase/client";
import type { TaxRate, TaxTransaction } from "@/types/database";

export async function listTaxRates(companyId: string): Promise<TaxRate[]> {
  const { data, error } = await supabase.from("tax_rates").select("*").eq("company_id", companyId).order("tax_type");
  if (error) throw error;
  return data as TaxRate[];
}

export async function createTaxRate(input: {
  companyId: string;
  name: string;
  code: string;
  rate: number;
  taxType: string;
  country?: string | null;
  effectiveDate?: string;
  expiryDate?: string | null;
}): Promise<TaxRate> {
  const { data, error } = await supabase
    .from("tax_rates")
    .insert({
      company_id: input.companyId, name: input.name, code: input.code, rate: input.rate, tax_type: input.taxType,
      country: input.country ?? null, effective_date: input.effectiveDate ?? new Date().toISOString().slice(0, 10),
      expiry_date: input.expiryDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TaxRate;
}

export async function updateTaxRate(id: string, patch: Partial<{ name: string; rate: number; expiryDate: string | null; isActive: boolean }>): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields.name = patch.name;
  if (patch.rate !== undefined) fields.rate = patch.rate;
  if (patch.expiryDate !== undefined) fields.expiry_date = patch.expiryDate;
  if (patch.isActive !== undefined) fields.is_active = patch.isActive;
  const { error } = await supabase.from("tax_rates").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteTaxRate(id: string): Promise<void> {
  const { error } = await supabase.from("tax_rates").delete().eq("id", id);
  if (error) throw error;
}

export interface TaxSummaryRow {
  tax_type: string;
  direction: "OUTPUT" | "INPUT";
  base_amount: number;
  tax_amount: number;
}

export async function getTaxSummary(companyId: string, startDate: string, endDate: string): Promise<TaxSummaryRow[]> {
  const { data, error } = await supabase.rpc("get_tax_summary", { p_company_id: companyId, p_start_date: startDate, p_end_date: endDate });
  if (error) throw error;
  return data as TaxSummaryRow[];
}

export async function listTaxTransactions(companyId: string, startDate: string, endDate: string): Promise<TaxTransaction[]> {
  const { data, error } = await supabase
    .from("tax_transactions")
    .select("*")
    .eq("company_id", companyId)
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  return data as TaxTransaction[];
}
