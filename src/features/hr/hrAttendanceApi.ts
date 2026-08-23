import { supabase } from "@/lib/supabase/client";
import type { Attendance, AttendanceCorrection, AttendanceStatus } from "@/types/database";

export async function listAttendance(companyId: string, opts: { employeeId?: string; from?: string; to?: string } = {}): Promise<Attendance[]> {
  let query = supabase.from("attendance").select("*").eq("company_id", companyId);
  if (opts.employeeId) query = query.eq("employee_id", opts.employeeId);
  if (opts.from) query = query.gte("attendance_date", opts.from);
  if (opts.to) query = query.lte("attendance_date", opts.to);
  const { data, error } = await query.order("attendance_date", { ascending: false });
  if (error) throw error;
  return data as Attendance[];
}

export async function recordAttendance(input: {
  companyId: string; employeeId: string; attendanceDate: string; clockIn?: string | null; clockOut?: string | null;
  breakMinutes?: number; status: AttendanceStatus; location?: string | null; notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("attendance").upsert({
    company_id: input.companyId, employee_id: input.employeeId, attendance_date: input.attendanceDate,
    clock_in: input.clockIn ?? null, clock_out: input.clockOut ?? null, break_minutes: input.breakMinutes ?? 0,
    status: input.status, location: input.location ?? null, notes: input.notes ?? null, source: "HR_ENTRY",
  }, { onConflict: "employee_id,attendance_date" });
  if (error) throw error;
}

export async function listAttendanceCorrections(companyId: string, employeeId?: string): Promise<AttendanceCorrection[]> {
  let query = supabase.from("attendance_corrections").select("*").eq("company_id", companyId);
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as AttendanceCorrection[];
}

export async function requestAttendanceCorrection(input: {
  employeeId: string; attendanceId?: string | null; attendanceDate: string;
  originalClockIn?: string | null; originalClockOut?: string | null;
  requestedClockIn?: string | null; requestedClockOut?: string | null; reason: string;
}): Promise<void> {
  const { error } = await supabase.from("attendance_corrections").insert({
    employee_id: input.employeeId, attendance_id: input.attendanceId ?? null, attendance_date: input.attendanceDate,
    original_clock_in: input.originalClockIn ?? null, original_clock_out: input.originalClockOut ?? null,
    requested_clock_in: input.requestedClockIn ?? null, requested_clock_out: input.requestedClockOut ?? null,
    reason: input.reason,
  });
  if (error) throw error;
}

export async function decideAttendanceCorrection(id: string, decision: "APPROVED" | "REJECTED", notes?: string | null): Promise<void> {
  const { error } = await supabase.rpc("decide_attendance_correction", { p_correction_id: id, p_decision: decision, p_notes: notes ?? null });
  if (error) throw error;
}
