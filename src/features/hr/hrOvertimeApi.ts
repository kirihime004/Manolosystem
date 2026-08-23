import { supabase } from "@/lib/supabase/client";
import type { OvertimeRequest, OvertimeRequestApproval, Timesheet } from "@/types/database";

export async function listOvertimeRequests(companyId: string, employeeId?: string): Promise<OvertimeRequest[]> {
  let query = supabase.from("overtime_requests").select("*").eq("company_id", companyId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query.order("work_date", { ascending: false });
  if (error) throw error;
  return data as OvertimeRequest[];
}

export async function createOvertimeRequest(input: {
  employeeId: string; workDate: string; startTime: string; endTime: string; reason?: string | null; departmentId?: string | null;
}): Promise<OvertimeRequest> {
  const { data, error } = await supabase.from("overtime_requests").insert({
    employee_id: input.employeeId, work_date: input.workDate, start_time: input.startTime, end_time: input.endTime,
    reason: input.reason ?? null, department_id: input.departmentId ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as OvertimeRequest;
}

export async function submitOvertimeRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("submit_overtime_request", { p_overtime_request_id: id });
  if (error) throw error;
}

export async function decideOvertimeRequestApproval(approvalId: string, decision: "APPROVED" | "REJECTED", comments?: string | null): Promise<void> {
  const { error } = await supabase.rpc("decide_overtime_request_approval", { p_approval_id: approvalId, p_decision: decision, p_comments: comments ?? null });
  if (error) throw error;
}

export async function listOvertimeApprovals(overtimeRequestId: string): Promise<OvertimeRequestApproval[]> {
  const { data, error } = await supabase.from("overtime_request_approvals").select("*").eq("overtime_request_id", overtimeRequestId).order("sequence");
  if (error) throw error;
  return data as OvertimeRequestApproval[];
}

// ---------------------------------------------------------------------
// Timesheets
// ---------------------------------------------------------------------
export async function listTimesheets(companyId: string, employeeId?: string): Promise<Timesheet[]> {
  let query = supabase.from("timesheets").select("*").eq("company_id", companyId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query.order("work_date", { ascending: false });
  if (error) throw error;
  return data as Timesheet[];
}

export async function createTimesheet(input: {
  employeeId: string; workDate: string; projectName?: string | null; taskName?: string | null;
  startTime?: string | null; endTime?: string | null; hours: number; notes?: string | null; submit?: boolean;
}): Promise<void> {
  const { error } = await supabase.from("timesheets").insert({
    employee_id: input.employeeId, work_date: input.workDate, project_name: input.projectName ?? null,
    task_name: input.taskName ?? null, start_time: input.startTime ?? null, end_time: input.endTime ?? null,
    hours: input.hours, notes: input.notes ?? null, status: input.submit ? "SUBMITTED" : "DRAFT",
  });
  if (error) throw error;
}

export async function submitTimesheet(id: string): Promise<void> {
  const { error } = await supabase.from("timesheets").update({ status: "SUBMITTED" }).eq("id", id);
  if (error) throw error;
}

export async function decideTimesheet(id: string, decision: "APPROVED" | "REJECTED"): Promise<void> {
  const { error } = await supabase.rpc("decide_timesheet", { p_timesheet_id: id, p_decision: decision });
  if (error) throw error;
}
