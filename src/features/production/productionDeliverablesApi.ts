import { supabase } from "@/lib/supabase/client";
import type { ProductionDeliverable, ProductionFile } from "@/types/database";

// ---------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------
export async function listDeliverables(projectId: string): Promise<ProductionDeliverable[]> {
  const { data, error } = await supabase.from("production_deliverables").select("*").eq("project_id", projectId).order("due_date");
  if (error) throw error;
  return data as ProductionDeliverable[];
}

export async function listAllDeliverables(companyId: string): Promise<ProductionDeliverable[]> {
  const { data, error } = await supabase.from("production_deliverables").select("*").eq("company_id", companyId).order("due_date");
  if (error) throw error;
  return data as ProductionDeliverable[];
}

export async function createDeliverable(input: {
  companyId: string; projectId: string; episodeId?: string | null; shotId?: string | null; name: string;
  description?: string | null; versionId?: string | null; recipientClientId?: string | null; dueDate?: string | null;
}): Promise<ProductionDeliverable> {
  const { data, error } = await supabase
    .from("production_deliverables")
    .insert({
      company_id: input.companyId, project_id: input.projectId, episode_id: input.episodeId ?? null, shot_id: input.shotId ?? null,
      name: input.name, description: input.description ?? null, version_id: input.versionId ?? null,
      recipient_client_id: input.recipientClientId ?? null, due_date: input.dueDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionDeliverable;
}

export async function updateDeliverable(id: string, patch: Partial<{ name: string; status: string; deliveredDate: string | null; notes: string | null; dueDate: string | null }>): Promise<void> {
  const { error } = await supabase
    .from("production_deliverables")
    .update({ name: patch.name, status: patch.status, delivered_date: patch.deliveredDate, notes: patch.notes, due_date: patch.dueDate })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDeliverable(id: string): Promise<void> {
  const { error } = await supabase.from("production_deliverables").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------
export async function listFiles(resourceType: string, resourceId: string): Promise<ProductionFile[]> {
  const { data, error } = await supabase.from("production_files").select("*").eq("resource_type", resourceType).eq("resource_id", resourceId).order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data as ProductionFile[];
}

export async function uploadProductionFile(input: { companyId: string; resourceType: string; resourceId: string; file: File; uploadedBy: string }): Promise<ProductionFile> {
  const path = `${input.companyId}/${input.resourceType}/${input.resourceId}/${Date.now()}-${input.file.name}`;

  const { error: uploadError } = await supabase.storage.from("production-files").upload(path, input.file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("production_files")
    .insert({
      company_id: input.companyId, resource_type: input.resourceType, resource_id: input.resourceId, filename: input.file.name,
      storage_path: path, file_type: input.file.type || null, file_size: input.file.size, uploaded_by: input.uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionFile;
}

export async function getProductionFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("production-files").createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteProductionFile(id: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from("production-files").remove([storagePath]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("production_files").delete().eq("id", id);
  if (error) throw error;
}
