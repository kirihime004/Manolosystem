import { supabase } from "@/lib/supabase/client";
import type { AdminAsset } from "@/types/database";

export async function listAdminAssets(companyId: string): Promise<AdminAsset[]> {
  const { data, error } = await supabase.from("admin_assets").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as AdminAsset[];
}

export async function getAdminAsset(id: string): Promise<AdminAsset> {
  const { data, error } = await supabase.from("admin_assets").select("*").eq("id", id).single();
  if (error) throw error;
  return data as AdminAsset;
}

// Posts the write-off journal entry (debit Loss on Disposal, credit Fixed
// Assets for the full purchase price) -- a separate, Finance-permission-
// gated step from disposing the asset itself.
export async function postAdminAssetDisposalEntry(companyId: string, assetId: string): Promise<string> {
  const { data, error } = await supabase.rpc("post_admin_asset_disposal_entry", { p_company_id: companyId, p_asset_id: assetId });
  if (error) throw error;
  return data as string;
}

export async function createAdminAsset(input: {
  companyId: string; name: string; category?: string | null; brand?: string | null; model?: string | null; serialNumber?: string | null;
  condition?: string | null; purchaseDate?: string | null; purchasePrice?: number | null; currencyId?: string | null; supplierId?: string | null;
  warrantyStart?: string | null; warrantyEnd?: string | null; locationId?: string | null; assignedTo?: string | null; departmentId?: string | null; notes?: string | null;
}): Promise<AdminAsset> {
  const { data, error } = await supabase
    .from("admin_assets")
    .insert({
      company_id: input.companyId, name: input.name, category: input.category ?? null, brand: input.brand ?? null, model: input.model ?? null,
      serial_number: input.serialNumber ?? null, condition: input.condition ?? null, purchase_date: input.purchaseDate ?? null,
      purchase_price: input.purchasePrice ?? null, currency_id: input.currencyId ?? null, supplier_id: input.supplierId ?? null,
      warranty_start: input.warrantyStart ?? null, warranty_end: input.warrantyEnd ?? null, location_id: input.locationId ?? null,
      assigned_to: input.assignedTo ?? null, department_id: input.departmentId ?? null, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminAsset;
}

export async function updateAdminAsset(id: string, patch: Partial<{ name: string; category: string; brand: string; model: string; serialNumber: string; condition: string; notes: string }>): Promise<void> {
  const { error } = await supabase
    .from("admin_assets")
    .update({ name: patch.name, category: patch.category, brand: patch.brand, model: patch.model, serial_number: patch.serialNumber, condition: patch.condition, notes: patch.notes })
    .eq("id", id);
  if (error) throw error;
}

export async function reassignAdminAsset(input: { assetId: string; assignedTo?: string | null; departmentId?: string | null; locationId?: string | null; reason?: string }): Promise<void> {
  const { error } = await supabase.rpc("reassign_admin_asset", {
    p_asset_id: input.assetId, p_assigned_to: input.assignedTo ?? null, p_department_id: input.departmentId ?? null,
    p_location_id: input.locationId ?? null, p_reason: input.reason ?? null,
  });
  if (error) throw error;
}

export async function disposeAdminAsset(assetId: string, status: "DISPOSED" | "RETIRED" | "LOST" | "DAMAGED", reason?: string): Promise<void> {
  const { error } = await supabase.rpc("dispose_admin_asset", { p_asset_id: assetId, p_status: status, p_reason: reason ?? null });
  if (error) throw error;
}
