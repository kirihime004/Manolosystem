import { supabase } from "@/lib/supabase/client";
import type { ProductionTask, ProductionTaskDependency, ProductionTaskType, ProductionWorkloadRow } from "@/types/database";

// ---------------------------------------------------------------------
// Task types
// ---------------------------------------------------------------------
export async function listTaskTypes(companyId: string): Promise<ProductionTaskType[]> {
  const { data, error } = await supabase.from("production_task_types").select("*").eq("company_id", companyId).order("sort_order");
  if (error) throw error;
  return data as ProductionTaskType[];
}

export async function createTaskType(input: { companyId: string; name: string; appliesTo: string; sortOrder?: number; color?: string | null }): Promise<ProductionTaskType> {
  const { data, error } = await supabase
    .from("production_task_types")
    .insert({ company_id: input.companyId, name: input.name, applies_to: input.appliesTo, sort_order: input.sortOrder ?? 0, color: input.color ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionTaskType;
}

export async function updateTaskType(id: string, patch: Partial<{ name: string; sortOrder: number; color: string | null; isActive: boolean }>): Promise<void> {
  const { error } = await supabase.from("production_task_types").update({ name: patch.name, sort_order: patch.sortOrder, color: patch.color, is_active: patch.isActive }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------
export async function listTasks(companyId: string, filters: { projectId?: string; shotId?: string; assetId?: string; assignedTo?: string } = {}): Promise<ProductionTask[]> {
  let query = supabase.from("production_tasks").select("*").eq("company_id", companyId).order("sort_order");
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.shotId) query = query.eq("shot_id", filters.shotId);
  if (filters.assetId) query = query.eq("asset_id", filters.assetId);
  if (filters.assignedTo) query = query.eq("assigned_to", filters.assignedTo);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionTask[];
}

export async function getTask(id: string): Promise<ProductionTask> {
  const { data, error } = await supabase.from("production_tasks").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProductionTask;
}

export async function createTask(input: {
  companyId: string; projectId: string; shotId?: string | null; assetId?: string | null; taskTypeId?: string | null;
  name: string; description?: string | null; priority?: string; assignedTo?: string | null;
  startDate?: string | null; dueDate?: string | null; estimatedHours?: number | null; bidAmount?: number | null;
}): Promise<ProductionTask> {
  const { data, error } = await supabase
    .from("production_tasks")
    .insert({
      company_id: input.companyId, project_id: input.projectId, shot_id: input.shotId ?? null, asset_id: input.assetId ?? null,
      task_type_id: input.taskTypeId ?? null, name: input.name, description: input.description ?? null, priority: input.priority ?? "MEDIUM",
      assigned_to: input.assignedTo ?? null, start_date: input.startDate ?? null, due_date: input.dueDate ?? null,
      estimated_hours: input.estimatedHours ?? null, bid_amount: input.bidAmount ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionTask;
}

export async function updateTaskStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("production_tasks").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateTask(id: string, patch: Partial<{
  name: string; description: string | null; status: string; priority: string; assignedTo: string | null;
  startDate: string | null; dueDate: string | null; estimatedHours: number | null; actualHours: number | null; sortOrder: number;
}>): Promise<void> {
  const { error } = await supabase
    .from("production_tasks")
    .update({
      name: patch.name, description: patch.description, status: patch.status, priority: patch.priority, assigned_to: patch.assignedTo,
      start_date: patch.startDate, due_date: patch.dueDate, estimated_hours: patch.estimatedHours, actual_hours: patch.actualHours,
      sort_order: patch.sortOrder,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("production_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------
export async function listTaskDependencies(taskId: string): Promise<ProductionTaskDependency[]> {
  const { data, error } = await supabase.from("production_task_dependencies").select("*").eq("task_id", taskId);
  if (error) throw error;
  return data as ProductionTaskDependency[];
}

export async function addTaskDependency(input: { companyId: string; taskId: string; dependsOnTaskId: string; dependencyType?: string }): Promise<ProductionTaskDependency> {
  const { data, error } = await supabase
    .from("production_task_dependencies")
    .insert({ company_id: input.companyId, task_id: input.taskId, depends_on_task_id: input.dependsOnTaskId, dependency_type: input.dependencyType ?? "FS" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionTaskDependency;
}

export async function removeTaskDependency(id: string): Promise<void> {
  const { error } = await supabase.from("production_task_dependencies").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Workload
// ---------------------------------------------------------------------
export async function getProductionWorkload(companyId: string, onDate?: string): Promise<ProductionWorkloadRow[]> {
  const { data, error } = await supabase.rpc("get_production_workload", { p_company_id: companyId, p_on_date: onDate ?? new Date().toISOString().slice(0, 10) });
  if (error) throw error;
  return data as ProductionWorkloadRow[];
}
