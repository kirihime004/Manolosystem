import { supabase } from "@/lib/supabase/client";
import type {
  Position, EmploymentType, EmploymentStatus, LeaveType, WorkSchedule, Holiday,
  OnboardingTaskTemplate, OffboardingTaskTemplate,
} from "@/types/database";

// ---------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------
export async function listPositions(companyId: string): Promise<Position[]> {
  const { data, error } = await supabase.from("positions").select("*").eq("company_id", companyId).order("title");
  if (error) throw error;
  return data as Position[];
}

export async function createPosition(input: {
  companyId: string; title: string; code?: string | null; departmentId?: string | null;
  level?: number | null; description?: string | null; reportsToPositionId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("positions").insert({
    company_id: input.companyId, title: input.title, code: input.code ?? null,
    department_id: input.departmentId ?? null, level: input.level ?? null,
    description: input.description ?? null, reports_to_position_id: input.reportsToPositionId ?? null,
  });
  if (error) throw error;
}

export async function updatePosition(id: string, patch: Partial<Position>): Promise<void> {
  const { error } = await supabase.from("positions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePosition(id: string): Promise<void> {
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Employment types / statuses (configurable, seeded with defaults)
// ---------------------------------------------------------------------
export async function listEmploymentTypes(companyId: string): Promise<EmploymentType[]> {
  const { data, error } = await supabase.from("employment_types").select("*").eq("company_id", companyId).order("label");
  if (error) throw error;
  return data as EmploymentType[];
}

export async function createEmploymentType(companyId: string, code: string, label: string): Promise<void> {
  const { error } = await supabase.from("employment_types").insert({ company_id: companyId, code, label });
  if (error) throw error;
}

export async function setEmploymentTypeStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<void> {
  const { error } = await supabase.from("employment_types").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function listEmploymentStatuses(companyId: string): Promise<EmploymentStatus[]> {
  const { data, error } = await supabase.from("employment_statuses").select("*").eq("company_id", companyId).order("label");
  if (error) throw error;
  return data as EmploymentStatus[];
}

export async function createEmploymentStatus(companyId: string, code: string, label: string, isActiveEmployment: boolean): Promise<void> {
  const { error } = await supabase.from("employment_statuses").insert({ company_id: companyId, code, label, is_active_employment: isActiveEmployment });
  if (error) throw error;
}

export async function setEmploymentStatusStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<void> {
  const { error } = await supabase.from("employment_statuses").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Leave types
// ---------------------------------------------------------------------
export async function listLeaveTypes(companyId: string): Promise<LeaveType[]> {
  const { data, error } = await supabase.from("leave_types").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as LeaveType[];
}

export async function createLeaveType(input: {
  companyId: string; code: string; name: string; isPaid: boolean; defaultEntitlementDays: number; requiresApproval: boolean;
}): Promise<void> {
  const { error } = await supabase.from("leave_types").insert({
    company_id: input.companyId, code: input.code, name: input.name, is_paid: input.isPaid,
    default_entitlement_days: input.defaultEntitlementDays, requires_approval: input.requiresApproval,
  });
  if (error) throw error;
}

export async function updateLeaveType(id: string, patch: Partial<LeaveType>): Promise<void> {
  const { error } = await supabase.from("leave_types").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Work schedules / holidays
// ---------------------------------------------------------------------
export async function listWorkSchedules(companyId: string): Promise<WorkSchedule[]> {
  const { data, error } = await supabase.from("work_schedules").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as WorkSchedule[];
}

export async function createWorkSchedule(input: {
  companyId: string; name: string; workingDays: number[]; startTime: string; endTime: string;
  breakMinutes: number; gracePeriodMinutes: number; isDefault: boolean;
}): Promise<void> {
  const { error } = await supabase.from("work_schedules").insert({
    company_id: input.companyId, name: input.name, working_days: input.workingDays,
    start_time: input.startTime, end_time: input.endTime, break_minutes: input.breakMinutes,
    grace_period_minutes: input.gracePeriodMinutes, is_default: input.isDefault,
  });
  if (error) throw error;
}

export async function listHolidays(companyId: string): Promise<Holiday[]> {
  const { data, error } = await supabase.from("holidays").select("*").eq("company_id", companyId).order("holiday_date");
  if (error) throw error;
  return data as Holiday[];
}

export async function createHoliday(input: {
  companyId: string; name: string; holidayDate: string; type: "NATIONAL" | "COMPANY" | "SPECIAL"; country?: string | null; location?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("holidays").insert({
    company_id: input.companyId, name: input.name, holiday_date: input.holidayDate,
    type: input.type, country: input.country ?? null, location: input.location ?? null,
  });
  if (error) throw error;
}

export async function setHolidayStatus(id: string, status: "ACTIVE" | "CANCELLED"): Promise<void> {
  const { error } = await supabase.from("holidays").update({ status }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Onboarding / offboarding checklist templates -- what start_onboarding()/
// start_offboarding() seed onto a specific employee's checklist.
// ---------------------------------------------------------------------
export async function listOnboardingTemplates(companyId: string): Promise<OnboardingTaskTemplate[]> {
  const { data, error } = await supabase.from("onboarding_task_templates").select("*").eq("company_id", companyId).order("sort_order");
  if (error) throw error;
  return data as OnboardingTaskTemplate[];
}

export async function createOnboardingTemplate(input: {
  companyId: string; department: OnboardingTaskTemplate["department"]; taskType: string; title: string; description?: string | null; sortOrder: number;
}): Promise<void> {
  const { error } = await supabase.from("onboarding_task_templates").insert({
    company_id: input.companyId, department: input.department, task_type: input.taskType,
    title: input.title, description: input.description ?? null, sort_order: input.sortOrder,
  });
  if (error) throw error;
}

export async function updateOnboardingTemplate(id: string, patch: Partial<OnboardingTaskTemplate>): Promise<void> {
  const { error } = await supabase.from("onboarding_task_templates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteOnboardingTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("onboarding_task_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function listOffboardingTemplates(companyId: string): Promise<OffboardingTaskTemplate[]> {
  const { data, error } = await supabase.from("offboarding_task_templates").select("*").eq("company_id", companyId).order("sort_order");
  if (error) throw error;
  return data as OffboardingTaskTemplate[];
}

export async function createOffboardingTemplate(input: {
  companyId: string; department: OffboardingTaskTemplate["department"]; taskType: string; title: string; description?: string | null; sortOrder: number;
}): Promise<void> {
  const { error } = await supabase.from("offboarding_task_templates").insert({
    company_id: input.companyId, department: input.department, task_type: input.taskType,
    title: input.title, description: input.description ?? null, sort_order: input.sortOrder,
  });
  if (error) throw error;
}

export async function updateOffboardingTemplate(id: string, patch: Partial<OffboardingTaskTemplate>): Promise<void> {
  const { error } = await supabase.from("offboarding_task_templates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteOffboardingTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("offboarding_task_templates").delete().eq("id", id);
  if (error) throw error;
}
