import { supabase } from "@/lib/supabase/client";
import type { ProductionMilestone } from "@/types/database";

export async function listMilestones(projectId: string): Promise<ProductionMilestone[]> {
  const { data, error } = await supabase.from("production_milestones").select("*").eq("project_id", projectId).order("due_date");
  if (error) throw error;
  return data as ProductionMilestone[];
}

export async function listAllMilestones(companyId: string): Promise<ProductionMilestone[]> {
  const { data, error } = await supabase.from("production_milestones").select("*").eq("company_id", companyId).order("due_date");
  if (error) throw error;
  return data as ProductionMilestone[];
}

export async function createMilestone(input: {
  companyId: string; projectId: string; episodeId?: string | null; name: string; description?: string | null;
  milestoneType?: string; dueDate: string; ownerId?: string | null;
}): Promise<ProductionMilestone> {
  const { data, error } = await supabase
    .from("production_milestones")
    .insert({
      company_id: input.companyId, project_id: input.projectId, episode_id: input.episodeId ?? null, name: input.name,
      description: input.description ?? null, milestone_type: input.milestoneType ?? "INTERNAL", due_date: input.dueDate, owner_id: input.ownerId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionMilestone;
}

export async function updateMilestone(id: string, patch: Partial<{ name: string; description: string | null; dueDate: string; status: string; completedDate: string | null; ownerId: string | null }>): Promise<void> {
  const { error } = await supabase
    .from("production_milestones")
    .update({ name: patch.name, description: patch.description, due_date: patch.dueDate, status: patch.status, completed_date: patch.completedDate, owner_id: patch.ownerId })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMilestone(id: string): Promise<void> {
  const { error } = await supabase.from("production_milestones").delete().eq("id", id);
  if (error) throw error;
}
