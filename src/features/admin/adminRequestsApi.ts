import { supabase } from "@/lib/supabase/client";
import type { AdminRequest, AdminRequestCategory, AdminRequestComment, AdminRequestApproval, AdminHistoryEntry } from "@/types/database";

// ---------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------
export async function listAdminRequestCategories(companyId: string): Promise<AdminRequestCategory[]> {
  const { data, error } = await supabase.from("admin_request_categories").select("*").eq("company_id", companyId).order("sort_order");
  if (error) throw error;
  return data as AdminRequestCategory[];
}

export async function createAdminRequestCategory(input: { companyId: string; name: string; sortOrder?: number }): Promise<AdminRequestCategory> {
  const { data, error } = await supabase
    .from("admin_request_categories")
    .insert({ company_id: input.companyId, name: input.name, sort_order: input.sortOrder ?? 0 })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminRequestCategory;
}

export async function updateAdminRequestCategory(id: string, patch: Partial<{ name: string; isActive: boolean; sortOrder: number }>): Promise<void> {
  const { error } = await supabase
    .from("admin_request_categories")
    .update({ name: patch.name, is_active: patch.isActive, sort_order: patch.sortOrder })
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------
export interface AdminRequestFilters {
  status?: string;
  categoryId?: string;
  mineOnly?: string; // employee id of the current user, or undefined
}

export async function listAdminRequests(companyId: string, filters: AdminRequestFilters = {}): Promise<AdminRequest[]> {
  let query = supabase.from("admin_requests").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.mineOnly) query = query.eq("requester_id", filters.mineOnly);
  const { data, error } = await query;
  if (error) throw error;
  return data as AdminRequest[];
}

export async function getAdminRequest(id: string): Promise<AdminRequest> {
  const { data, error } = await supabase.from("admin_requests").select("*").eq("id", id).single();
  if (error) throw error;
  return data as AdminRequest;
}

export async function createAdminRequest(input: {
  companyId: string;
  requesterId: string;
  departmentId?: string | null;
  categoryId?: string | null;
  subject: string;
  description?: string | null;
  priority: string;
  requiredDate?: string | null;
  locationId?: string | null;
  estimatedCost?: number | null;
  currencyId?: string | null;
}): Promise<AdminRequest> {
  const { data, error } = await supabase
    .from("admin_requests")
    .insert({
      company_id: input.companyId,
      requester_id: input.requesterId,
      department_id: input.departmentId ?? null,
      category_id: input.categoryId ?? null,
      subject: input.subject,
      description: input.description ?? null,
      priority: input.priority,
      required_date: input.requiredDate ?? null,
      location_id: input.locationId ?? null,
      estimated_cost: input.estimatedCost ?? null,
      currency_id: input.currencyId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as AdminRequest;
}

export async function updateAdminRequest(id: string, patch: Partial<{ subject: string; description: string; priority: string; requiredDate: string | null }>): Promise<void> {
  const { error } = await supabase
    .from("admin_requests")
    .update({ subject: patch.subject, description: patch.description, priority: patch.priority, required_date: patch.requiredDate })
    .eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Workflow RPCs
// ---------------------------------------------------------------------
export async function submitAdminRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_admin_request", { p_request_id: id });
  if (error) throw error;
}

export async function startAdminRequestReview(id: string): Promise<void> {
  const { error } = await supabase.rpc("start_admin_request_review", { p_request_id: id });
  if (error) throw error;
}

export async function routeAdminRequestForApproval(id: string): Promise<void> {
  const { error } = await supabase.rpc("route_admin_request_for_approval", { p_request_id: id });
  if (error) throw error;
}

export async function decideAdminRequestApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string): Promise<void> {
  const { error } = await supabase.rpc("decide_admin_request_approval", { p_approval_id: approvalId, p_decision: decision, p_comments: comments ?? null });
  if (error) throw error;
}

export async function assignAdminRequest(id: string, assignedTo: string): Promise<void> {
  const { error } = await supabase.rpc("assign_admin_request", { p_request_id: id, p_assigned_to: assignedTo });
  if (error) throw error;
}

export async function startAdminRequestWork(id: string): Promise<void> {
  const { error } = await supabase.rpc("start_admin_request_work", { p_request_id: id });
  if (error) throw error;
}

export async function markAdminRequestWaiting(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("mark_admin_request_waiting", { p_request_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function completeAdminRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("complete_admin_request", { p_request_id: id });
  if (error) throw error;
}

export async function closeAdminRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("close_admin_request", { p_request_id: id });
  if (error) throw error;
}

export async function rejectAdminRequest(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("reject_admin_request", { p_request_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

export async function cancelAdminRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_admin_request", { p_request_id: id });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Comments & approvals & history
// ---------------------------------------------------------------------
export async function listAdminRequestComments(requestId: string): Promise<AdminRequestComment[]> {
  const { data, error } = await supabase.from("admin_request_comments").select("*").eq("request_id", requestId).order("created_at");
  if (error) throw error;
  return data as AdminRequestComment[];
}

export async function addAdminRequestComment(input: { companyId: string; requestId: string; authorId: string; comment: string; isInternal?: boolean }): Promise<void> {
  const { error } = await supabase.from("admin_request_comments").insert({
    company_id: input.companyId, request_id: input.requestId, author_id: input.authorId, comment: input.comment, is_internal: input.isInternal ?? false,
  });
  if (error) throw error;
}

export async function listAdminRequestApprovals(requestId: string): Promise<AdminRequestApproval[]> {
  const { data, error } = await supabase.from("admin_request_approvals").select("*").eq("request_id", requestId).order("sequence");
  if (error) throw error;
  return data as AdminRequestApproval[];
}

export async function listAdminRequestHistory(requestId: string): Promise<AdminHistoryEntry[]> {
  const { data, error } = await supabase
    .from("admin_history")
    .select("*")
    .eq("resource_type", "ADMIN_REQUEST")
    .eq("resource_id", requestId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AdminHistoryEntry[];
}
