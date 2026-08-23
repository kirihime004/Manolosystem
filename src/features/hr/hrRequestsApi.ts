import { supabase } from "@/lib/supabase/client";
import type { HrRequest, HrRequestComment, HrRequestType } from "@/types/database";

export async function listHrRequests(companyId: string, employeeId?: string): Promise<HrRequest[]> {
  let query = supabase.from("hr_requests").select("*").eq("company_id", companyId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as HrRequest[];
}

export async function getHrRequest(id: string): Promise<HrRequest | null> {
  const { data, error } = await supabase.from("hr_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as HrRequest | null;
}

export async function createHrRequest(input: {
  employeeId: string; requestType: HrRequestType; subject: string; description?: string | null;
}): Promise<HrRequest> {
  const { data, error } = await supabase.from("hr_requests").insert({
    employee_id: input.employeeId, request_type: input.requestType, subject: input.subject, description: input.description ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as HrRequest;
}

export async function transitionHrRequest(id: string, newStatus: HrRequest["status"], comment?: string | null): Promise<void> {
  const { error } = await supabase.rpc("transition_hr_request", { p_hr_request_id: id, p_new_status: newStatus, p_comment: comment ?? null });
  if (error) throw error;
}

export async function listHrRequestComments(hrRequestId: string): Promise<HrRequestComment[]> {
  const { data, error } = await supabase.from("hr_request_comments").select("*").eq("hr_request_id", hrRequestId).order("created_at");
  if (error) throw error;
  return data as HrRequestComment[];
}

export async function addHrRequestComment(hrRequestId: string, comment: string): Promise<void> {
  const { error } = await supabase.from("hr_request_comments").insert({ hr_request_id: hrRequestId, comment });
  if (error) throw error;
}
