import { supabase } from "@/lib/supabase/client";
import type { OfficeSupply, OfficeSupplyMovement, OfficeSupplyRequest } from "@/types/database";

// ---------------------------------------------------------------------
// Office supplies
// ---------------------------------------------------------------------
export async function listOfficeSupplies(companyId: string): Promise<OfficeSupply[]> {
  const { data, error } = await supabase.from("office_supplies").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as OfficeSupply[];
}

export async function createOfficeSupply(input: {
  companyId: string; name: string; category?: string | null; unit?: string; minimumQuantity?: number;
  reorderQuantity?: number | null; unitCost?: number | null; currencyId?: string | null; supplierId?: string | null; locationId?: string | null;
}): Promise<OfficeSupply> {
  const { data, error } = await supabase
    .from("office_supplies")
    .insert({
      company_id: input.companyId, name: input.name, category: input.category ?? null, unit: input.unit ?? "each",
      minimum_quantity: input.minimumQuantity ?? 0, reorder_quantity: input.reorderQuantity ?? null,
      unit_cost: input.unitCost ?? null, currency_id: input.currencyId ?? null, supplier_id: input.supplierId ?? null, location_id: input.locationId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as OfficeSupply;
}

export async function updateOfficeSupply(id: string, patch: Partial<{ name: string; category: string; unit: string; minimumQuantity: number; reorderQuantity: number | null; unitCost: number | null; status: string }>): Promise<void> {
  const { error } = await supabase
    .from("office_supplies")
    .update({ name: patch.name, category: patch.category, unit: patch.unit, minimum_quantity: patch.minimumQuantity, reorder_quantity: patch.reorderQuantity, unit_cost: patch.unitCost, status: patch.status })
    .eq("id", id);
  if (error) throw error;
}

export async function listSupplyMovements(supplyId: string): Promise<OfficeSupplyMovement[]> {
  const { data, error } = await supabase.from("office_supply_movements").select("*").eq("supply_id", supplyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as OfficeSupplyMovement[];
}

export async function recordSupplyMovement(input: {
  supplyId: string; movementType: string; quantity: number; adjustmentSign?: 1 | -1; reason?: string; notes?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("record_supply_movement", {
    p_supply_id: input.supplyId, p_movement_type: input.movementType, p_quantity: input.quantity,
    p_adjustment_sign: input.adjustmentSign ?? 1, p_reference_type: null, p_reference_id: null,
    p_reason: input.reason ?? null, p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ---------------------------------------------------------------------
// Supply requests
// ---------------------------------------------------------------------
export async function listOfficeSupplyRequests(companyId: string): Promise<OfficeSupplyRequest[]> {
  const { data, error } = await supabase.from("office_supply_requests").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as OfficeSupplyRequest[];
}

export async function createOfficeSupplyRequest(input: {
  companyId: string; requesterId: string; departmentId?: string | null; supplyId: string;
  quantityRequested: number; reason?: string | null; neededBy?: string | null;
}): Promise<OfficeSupplyRequest> {
  const { data, error } = await supabase
    .from("office_supply_requests")
    .insert({
      company_id: input.companyId, requester_id: input.requesterId, department_id: input.departmentId ?? null,
      supply_id: input.supplyId, quantity_requested: input.quantityRequested, reason: input.reason ?? null, needed_by: input.neededBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as OfficeSupplyRequest;
}

export async function decideOfficeSupplyRequest(id: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc("decide_office_supply_request", { p_request_id: id, p_approve: approve });
  if (error) throw error;
}

export async function issueOfficeSupplyRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("issue_office_supply_request", { p_request_id: id });
  if (error) throw error;
}
