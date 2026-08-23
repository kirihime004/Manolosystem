import { supabase } from "@/lib/supabase/client";
import type { LeaveBalance, LeaveRequest, LeaveRequestApproval } from "@/types/database";

export async function listLeaveRequests(companyId: string, employeeId?: string): Promise<LeaveRequest[]> {
  let query = supabase.from("leave_requests").select("*").eq("company_id", companyId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as LeaveRequest[];
}

export async function getLeaveRequest(id: string): Promise<LeaveRequest | null> {
  const { data, error } = await supabase.from("leave_requests").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as LeaveRequest | null;
}

export async function createLeaveRequest(input: {
  employeeId: string; leaveTypeId: string; startDate: string; endDate: string; days: number; reason?: string | null;
}): Promise<LeaveRequest> {
  const { data, error } = await supabase.from("leave_requests").insert({
    employee_id: input.employeeId, leave_type_id: input.leaveTypeId, start_date: input.startDate,
    end_date: input.endDate, days: input.days, reason: input.reason ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as LeaveRequest;
}

export async function submitLeaveRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_leave_request", { p_leave_request_id: id });
  if (error) throw error;
}

export async function decideLeaveRequestApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string | null): Promise<void> {
  const { error } = await supabase.rpc("decide_leave_request_approval", { p_approval_id: approvalId, p_decision: decision, p_comments: comments ?? null });
  if (error) throw error;
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_leave_request", { p_leave_request_id: id });
  if (error) throw error;
}

export async function listLeaveApprovals(leaveRequestId: string): Promise<LeaveRequestApproval[]> {
  const { data, error } = await supabase.from("leave_request_approvals").select("*").eq("leave_request_id", leaveRequestId).order("sequence");
  if (error) throw error;
  return data as LeaveRequestApproval[];
}

export async function listMyPendingLeaveApprovals(companyId: string): Promise<(LeaveRequestApproval & { leave_requests: LeaveRequest })[]> {
  const { data, error } = await supabase
    .from("leave_request_approvals")
    .select("*, leave_requests!inner(*)")
    .eq("company_id", companyId)
    .eq("decision", "PENDING");
  if (error) throw error;
  return data as unknown as (LeaveRequestApproval & { leave_requests: LeaveRequest })[];
}

export async function listLeaveBalances(companyId: string, employeeId: string, year: number): Promise<LeaveBalance[]> {
  const { data, error } = await supabase.from("leave_balances").select("*").eq("company_id", companyId).eq("employee_id", employeeId).eq("year", year);
  if (error) throw error;
  return data as LeaveBalance[];
}

export async function ensureLeaveBalance(employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalance> {
  const { data, error } = await supabase.rpc("get_or_create_leave_balance", { p_employee_id: employeeId, p_leave_type_id: leaveTypeId, p_year: year });
  if (error) throw error;
  return data as LeaveBalance;
}
