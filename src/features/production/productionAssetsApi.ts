import { supabase } from "@/lib/supabase/client";
import type { ProductionAsset } from "@/types/database";

export async function listAssets(projectId: string): Promise<ProductionAsset[]> {
  const { data, error } = await supabase.from("production_assets").select("*").eq("project_id", projectId).order("name");
  if (error) throw error;
  return data as ProductionAsset[];
}

export async function getAsset(id: string): Promise<ProductionAsset> {
  const { data, error } = await supabase.from("production_assets").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProductionAsset;
}

// "My Assets" (an employee's self-service view) spans however many
// projects their tasks touch -- assets themselves carry no assignee
// column, only tasks do -- so it needs a batch lookup across those
// projects' assets by id rather than the single-project listAssets above.
export async function getAssetsByIds(ids: string[]): Promise<ProductionAsset[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("production_assets").select("*").in("id", ids);
  if (error) throw error;
  return data as ProductionAsset[];
}

export async function createAsset(input: { companyId: string; projectId: string; name: string; assetCategory: string; description?: string | null }): Promise<ProductionAsset> {
  const { data, error } = await supabase
    .from("production_assets")
    .insert({ company_id: input.companyId, project_id: input.projectId, name: input.name, asset_category: input.assetCategory, description: input.description ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionAsset;
}

export async function updateAsset(id: string, patch: Partial<{ name: string; description: string | null; status: string; thumbnailPath: string | null }>): Promise<void> {
  const { error } = await supabase.from("production_assets").update({ name: patch.name, description: patch.description, status: patch.status, thumbnail_path: patch.thumbnailPath }).eq("id", id);
  if (error) throw error;
}

export async function deleteAsset(id: string): Promise<void> {
  const { error } = await supabase.from("production_assets").delete().eq("id", id);
  if (error) throw error;
}
