import { supabase } from "@/lib/supabase/client";

export interface HrDashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  newEmployeesThisMonth: number;
  employeesOnLeaveToday: number;
  employeesAbsentToday: number;
  pendingHrRequests: number;
  contractsExpiring90d: number;
  probationEnding14d: number;
  pendingPayrollPeriods: number;
  attendanceExceptionsToday: number;
  byDepartment: { label: string; count: number }[];
  byEmploymentType: { label: string; count: number }[];
  byEmploymentStatus: { label: string; count: number }[];
}

// Every figure here comes from a real query against company data -- no
// fabricated numbers. Callers render "No data available" when a bucket
// is empty rather than inventing a placeholder value.
export async function getHrDashboardStats(companyId: string): Promise<HrDashboardStats> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";

  const [
    employees, activeStatuses, newHires, onLeaveToday, absentToday, pendingRequests,
    expiringContracts, endingProbation, pendingPayroll,
  ] = await Promise.all([
    supabase.from("employees").select("id, department_id, employment_type_id, employment_status_id, hire_date").eq("company_id", companyId),
    supabase.from("employment_statuses").select("id, is_active_employment").eq("company_id", companyId),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("hire_date", monthStart),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("attendance_date", today).eq("status", "ON_LEAVE"),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("attendance_date", today).eq("status", "ABSENT"),
    supabase.from("hr_requests").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase.from("employment_contracts").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["ACTIVE", "EXPIRING"]).lte("end_date", new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)).gte("end_date", today),
    supabase.from("employees").select("id", { count: "exact", head: true }).eq("company_id", companyId).lte("probation_end_date", new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)).gte("probation_end_date", today),
    supabase.from("payroll_periods").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["DRAFT", "OPEN", "PROCESSING", "REVIEW"]),
  ]);

  const [departments, employmentTypes, employmentStatuses] = await Promise.all([
    supabase.from("departments").select("id, name").eq("company_id", companyId),
    supabase.from("employment_types").select("id, label").eq("company_id", companyId),
    supabase.from("employment_statuses").select("id, label").eq("company_id", companyId),
  ]);

  const empRows = employees.data ?? [];
  const activeStatusIds = new Set((activeStatuses.data ?? []).filter((s) => s.is_active_employment).map((s) => s.id));
  const deptMap = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  const typeMap = new Map((employmentTypes.data ?? []).map((t) => [t.id, t.label]));
  const statusMap = new Map((employmentStatuses.data ?? []).map((s) => [s.id, s.label]));

  const countBy = (rows: { department_id?: string | null; employment_type_id?: string | null; employment_status_id?: string | null }[], key: "department_id" | "employment_type_id" | "employment_status_id", labels: Map<string, string>) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const id = row[key];
      const label = id ? (labels.get(id) ?? "Unassigned") : "Unassigned";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };

  return {
    totalEmployees: empRows.length,
    activeEmployees: empRows.filter((e) => e.employment_status_id && activeStatusIds.has(e.employment_status_id)).length,
    newEmployeesThisMonth: newHires.count ?? 0,
    employeesOnLeaveToday: onLeaveToday.count ?? 0,
    employeesAbsentToday: absentToday.count ?? 0,
    pendingHrRequests: pendingRequests.count ?? 0,
    contractsExpiring90d: expiringContracts.count ?? 0,
    probationEnding14d: endingProbation.count ?? 0,
    pendingPayrollPeriods: pendingPayroll.count ?? 0,
    attendanceExceptionsToday: (onLeaveToday.count ?? 0) + (absentToday.count ?? 0),
    byDepartment: countBy(empRows, "department_id", deptMap),
    byEmploymentType: countBy(empRows, "employment_type_id", typeMap),
    byEmploymentStatus: countBy(empRows, "employment_status_id", statusMap),
  };
}
