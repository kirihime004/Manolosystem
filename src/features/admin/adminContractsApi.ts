import { supabase } from "@/lib/supabase/client";
import type { AdminContract } from "@/types/database";

export async function listAdminContracts(companyId: string): Promise<AdminContract[]> {
  const { data, error } = await supabase.from("admin_contracts").select("*").eq("company_id", companyId).order("end_date");
  if (error) throw error;
  return data as AdminContract[];
}

export async function getAdminContract(id: string): Promise<AdminContract> {
  const { data, error } = await supabase.from("admin_contracts").select("*").eq("id", id).single();
  if (error) throw error;
  return data as AdminContract;
}

export async function createAdminContract(input: {
  companyId: string; contractName: string; contractType: string; supplierId?: string | null; startDate: string; endDate: string;
  value?: number | null; currencyId?: string | null; paymentTerms?: string | null; ownerId?: string | null; notes?: string | null;
}): Promise<AdminContract> {
  const { data, error } = await supabase
    .from("admin_contracts")
    .insert({
      company_id: input.companyId, contract_name: input.contractName, contract_type: input.contractType, supplier_id: input.supplierId ?? null,
      start_date: input.startDate, end_date: input.endDate, value: input.value ?? null, currency_id: input.currencyId ?? null,
      payment_terms: input.paymentTerms ?? null, owner_id: input.ownerId ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminContract;
}

export async function updateAdminContract(id: string, patch: Partial<{ contractName: string; paymentTerms: string; ownerId: string | null; notes: string }>): Promise<void> {
  const { error } = await supabase.from("admin_contracts").update({ contract_name: patch.contractName, payment_terms: patch.paymentTerms, owner_id: patch.ownerId, notes: patch.notes }).eq("id", id);
  if (error) throw error;
}

export async function activateAdminContract(id: string): Promise<void> {
  const { error } = await supabase.rpc("activate_admin_contract", { p_contract_id: id });
  if (error) throw error;
}

export async function renewAdminContract(id: string, newStartDate: string, newEndDate: string, newValue?: number): Promise<string> {
  const { data, error } = await supabase.rpc("renew_admin_contract", { p_contract_id: id, p_new_start_date: newStartDate, p_new_end_date: newEndDate, p_new_value: newValue ?? null });
  if (error) throw error;
  return data as string;
}

export async function terminateAdminContract(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("terminate_admin_contract", { p_contract_id: id, p_reason: reason ?? null });
  if (error) throw error;
}
