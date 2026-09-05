import { supabase } from "@/lib/supabase/client";
import type { ProductionVersion, ProductionReview, ProductionNote, AnnotationStroke } from "@/types/database";

// ---------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------
export async function listVersions(filters: { shotId?: string; assetId?: string; taskId?: string; projectId?: string }): Promise<ProductionVersion[]> {
  let query = supabase.from("production_versions").select("*").order("version_number", { ascending: false });
  if (filters.shotId) query = query.eq("shot_id", filters.shotId);
  if (filters.assetId) query = query.eq("asset_id", filters.assetId);
  if (filters.taskId) query = query.eq("task_id", filters.taskId);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionVersion[];
}

export async function listPendingReviewVersions(companyId: string): Promise<ProductionVersion[]> {
  const { data, error } = await supabase.from("production_versions").select("*").eq("company_id", companyId).eq("status", "PENDING_REVIEW").order("submitted_at", { ascending: false });
  if (error) throw error;
  return data as ProductionVersion[];
}

export async function createVersion(input: {
  companyId: string; projectId: string; shotId?: string | null; assetId?: string | null; taskId?: string | null;
  name?: string | null; description?: string | null; filePath?: string | null; thumbnailPath?: string | null;
  frameStart?: number | null; frameEnd?: number | null; submittedBy: string; notes?: string | null;
  file?: File | null;
}): Promise<ProductionVersion> {
  // production_versions has no UPDATE policy -- it's append-only history,
  // same as every version-controlled table in this app -- so the media
  // file must be uploaded to a path keyed by a fresh id *before* the row
  // is inserted, rather than uploading after and patching file_path in.
  let filePath = input.filePath ?? null;
  if (input.file) {
    filePath = `${input.companyId}/VERSION/${crypto.randomUUID()}/${input.file.name}`;
    const { error: uploadError } = await supabase.storage.from("production-files").upload(filePath, input.file);
    if (uploadError) throw uploadError;
  }

  const { data, error } = await supabase
    .from("production_versions")
    .insert({
      company_id: input.companyId, project_id: input.projectId, shot_id: input.shotId ?? null, asset_id: input.assetId ?? null,
      task_id: input.taskId ?? null, name: input.name ?? null, description: input.description ?? null, file_path: filePath,
      thumbnail_path: input.thumbnailPath ?? null, frame_start: input.frameStart ?? null, frame_end: input.frameEnd ?? null,
      submitted_by: input.submittedBy, notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionVersion;
}

export async function getVersionMediaUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("production-files").createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function setVersionClientVisible(id: string, clientVisible: boolean): Promise<void> {
  const { error } = await supabase.from("production_versions").update({ client_visible: clientVisible }).eq("id", id);
  if (error) throw error;
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from("production_versions").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------
export async function listReviews(versionId: string): Promise<ProductionReview[]> {
  const { data, error } = await supabase.from("production_reviews").select("*").eq("version_id", versionId).order("created_at");
  if (error) throw error;
  return data as ProductionReview[];
}

export async function listReviewsForReviewer(employeeId: string): Promise<ProductionReview[]> {
  const { data, error } = await supabase.from("production_reviews").select("*").eq("reviewer_employee_id", employeeId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionReview[];
}

// production_reviews only carries version_id -- the version's own name,
// shot/asset, and project live on production_versions, so "My Approvals"
// needs this small batch lookup to show anything beyond a bare version id.
export async function getVersionsByIds(ids: string[]): Promise<ProductionVersion[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("production_versions").select("*").in("id", ids);
  if (error) throw error;
  return data as ProductionVersion[];
}

export async function requestReview(input: { companyId: string; versionId: string; reviewerEmployeeId: string; requestedBy: string }): Promise<ProductionReview> {
  const { data, error } = await supabase
    .from("production_reviews")
    .insert({ company_id: input.companyId, version_id: input.versionId, reviewer_type: "EMPLOYEE", reviewer_employee_id: input.reviewerEmployeeId, requested_by: input.requestedBy })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionReview;
}

export async function decideReview(id: string, decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED", comment?: string | null): Promise<void> {
  const { error } = await supabase.from("production_reviews").update({ decision, comment: comment ?? null }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------
export async function listNotes(resourceType: string, resourceId: string): Promise<ProductionNote[]> {
  const { data, error } = await supabase.from("production_notes").select("*").eq("resource_type", resourceType).eq("resource_id", resourceId).order("created_at");
  if (error) throw error;
  return data as ProductionNote[];
}

// Notes are attached to one specific shot/asset/task/version, not directly
// to a project -- there's no project_id column on production_notes -- so a
// project-wide "all notes" tab has to fan out over every resource id that
// belongs to the project (its shots, assets, and tasks) instead of a single
// eq() filter.
export async function listNotesForResources(resourceIds: string[]): Promise<ProductionNote[]> {
  if (resourceIds.length === 0) return [];
  const { data, error } = await supabase.from("production_notes").select("*").in("resource_id", resourceIds).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionNote[];
}

export async function createNote(input: {
  companyId: string; resourceType: string; resourceId: string; authorId: string; content: string;
  parentNoteId?: string | null; frameNumber?: number | null;
  annotationData?: AnnotationStroke[] | null; annotationWidth?: number | null; annotationHeight?: number | null;
}): Promise<ProductionNote> {
  const { data, error } = await supabase
    .from("production_notes")
    .insert({
      company_id: input.companyId, resource_type: input.resourceType, resource_id: input.resourceId, author_id: input.authorId,
      content: input.content, parent_note_id: input.parentNoteId ?? null, frame_number: input.frameNumber ?? null,
      annotation_data: input.annotationData ?? null, annotation_width: input.annotationWidth ?? null, annotation_height: input.annotationHeight ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionNote;
}

export async function resolveNote(id: string, resolvedBy: string): Promise<void> {
  const { error } = await supabase.from("production_notes").update({ status: "RESOLVED", resolved_by: resolvedBy, resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
