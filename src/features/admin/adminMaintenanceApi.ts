import { supabase } from "@/lib/supabase/client";
import type { MaintenanceRecord, MaintenanceSchedule } from "@/types/database";

export async function listMaintenanceRecords(companyId: string): Promise<MaintenanceRecord[]> {
  const { data, error } = await supabase.from("maintenance_records").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as MaintenanceRecord[];
}

export async function getMaintenanceRecord(id: string): Promise<MaintenanceRecord> {
  const { data, error } = await supabase.from("maintenance_records").select("*").eq("id", id).single();
  if (error) throw error;
  return data as MaintenanceRecord;
}

export async function listMaintenanceRecordsByAsset(assetId: string): Promise<MaintenanceRecord[]> {
  const { data, error } = await supabase.from("maintenance_records").select("*").eq("asset_id", assetId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as MaintenanceRecord[];
}

export async function createMaintenanceRecord(input: {
  companyId: string; assetId?: string | null; roomId?: string | null; locationId?: string | null; reportedBy?: string | null;
  issue: string; priority: string; estimatedCost?: number | null; currencyId?: string | null; supplierId?: string | null;
}): Promise<MaintenanceRecord> {
  const { data, error } = await supabase
    .from("maintenance_records")
    .insert({
      company_id: input.companyId, asset_id: input.assetId ?? null, room_id: input.roomId ?? null, location_id: input.locationId ?? null,
      reported_by: input.reportedBy ?? null, issue: input.issue, priority: input.priority,
      estimated_cost: input.estimatedCost ?? null, currency_id: input.currencyId ?? null, supplier_id: input.supplierId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MaintenanceRecord;
}

export async function assignMaintenance(id: string, assignedTo: string, scheduledDate?: string): Promise<void> {
  const { error } = await supabase.rpc("assign_maintenance", { p_maintenance_id: id, p_assigned_to: assignedTo, p_scheduled_date: scheduledDate ?? null });
  if (error) throw error;
}

export async function startMaintenance(id: string): Promise<void> {
  const { error } = await supabase.rpc("start_maintenance", { p_maintenance_id: id });
  if (error) throw error;
}

export async function completeMaintenance(id: string, actualCost?: number, notes?: string): Promise<void> {
  const { error } = await supabase.rpc("complete_maintenance", { p_maintenance_id: id, p_actual_cost: actualCost ?? null, p_notes: notes ?? null });
  if (error) throw error;
}

export async function cancelMaintenance(id: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_maintenance", { p_maintenance_id: id, p_reason: reason ?? null });
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Preventive maintenance schedules
// ---------------------------------------------------------------------
export async function listMaintenanceSchedules(companyId: string): Promise<MaintenanceSchedule[]> {
  const { data, error } = await supabase.from("maintenance_schedules").select("*").eq("company_id", companyId).order("next_maintenance_date");
  if (error) throw error;
  return data as MaintenanceSchedule[];
}

export async function createMaintenanceSchedule(input: {
  companyId: string; assetId?: string | null; roomId?: string | null; locationId?: string | null; title: string;
  frequency: string; intervalDays?: number | null; nextMaintenanceDate: string; supplierId?: string | null; estimatedCost?: number | null; currencyId?: string | null;
}): Promise<MaintenanceSchedule> {
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .insert({
      company_id: input.companyId, asset_id: input.assetId ?? null, room_id: input.roomId ?? null, location_id: input.locationId ?? null,
      title: input.title, frequency: input.frequency, interval_days: input.intervalDays ?? null, next_maintenance_date: input.nextMaintenanceDate,
      supplier_id: input.supplierId ?? null, estimated_cost: input.estimatedCost ?? null, currency_id: input.currencyId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MaintenanceSchedule;
}

export async function updateMaintenanceSchedule(id: string, patch: Partial<{ title: string; isActive: boolean; nextMaintenanceDate: string }>): Promise<void> {
  const { error } = await supabase.from("maintenance_schedules").update({ title: patch.title, is_active: patch.isActive, next_maintenance_date: patch.nextMaintenanceDate }).eq("id", id);
  if (error) throw error;
}
