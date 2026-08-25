import { supabase } from "@/lib/supabase/client";
import type { AdminDocument } from "@/types/database";

export async function listAdminDocuments(companyId: string, resourceType?: string, resourceId?: string): Promise<AdminDocument[]> {
  let query = supabase.from("admin_documents").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (resourceType) query = query.eq("resource_type", resourceType);
  if (resourceId) query = query.eq("resource_id", resourceId);
  const { data, error } = await query;
  if (error) throw error;
  return data as AdminDocument[];
}

export async function uploadAdminDocument(input: {
  companyId: string; resourceType: string; resourceId: string; documentType: string; title: string;
  file: File; issueDate?: string | null; expiryDate?: string | null;
}): Promise<AdminDocument> {
  const path = `${input.companyId}/${input.resourceType}/${input.resourceId}/${Date.now()}-${input.file.name}`;

  const { error: uploadError } = await supabase.storage.from("admin-documents").upload(path, input.file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("admin_documents")
    .insert({
      company_id: input.companyId, resource_type: input.resourceType, resource_id: input.resourceId, document_type: input.documentType,
      title: input.title, storage_path: path, issue_date: input.issueDate ?? null, expiry_date: input.expiryDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminDocument;
}

export async function getAdminDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("admin-documents").createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAdminDocument(id: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from("admin-documents").remove([storagePath]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("admin_documents").delete().eq("id", id);
  if (error) throw error;
}
