import { supabase } from "@/lib/supabase/client";
import type { ProductionShot } from "@/types/database";

export async function listShots(projectId: string, sequenceId?: string): Promise<ProductionShot[]> {
  let query = supabase.from("production_shots").select("*").eq("project_id", projectId).order("shot_number");
  if (sequenceId) query = query.eq("sequence_id", sequenceId);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionShot[];
}

export async function getShot(id: string): Promise<ProductionShot> {
  const { data, error } = await supabase.from("production_shots").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProductionShot;
}

export async function getShotFullCode(shotId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_shot_full_code", { p_shot_id: shotId });
  if (error) throw error;
  return data as string | null;
}

export async function createShot(input: {
  companyId: string; projectId: string; sequenceId: string; shotNumber: number; description?: string | null;
  frameStart?: number; frameEnd?: number | null; complexity?: string | null; dueDate?: string | null;
}): Promise<ProductionShot> {
  const { data, error } = await supabase
    .from("production_shots")
    .insert({
      company_id: input.companyId, project_id: input.projectId, sequence_id: input.sequenceId, shot_number: input.shotNumber,
      description: input.description ?? null, frame_start: input.frameStart ?? 1001, frame_end: input.frameEnd ?? null,
      complexity: input.complexity ?? null, due_date: input.dueDate ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionShot;
}

export async function updateShot(id: string, patch: Partial<{
  description: string | null; status: string; frameEnd: number | null; complexity: string | null;
  dueDate: string | null; thumbnailPath: string | null; clientVisible: boolean;
}>): Promise<void> {
  const { error } = await supabase
    .from("production_shots")
    .update({
      description: patch.description, status: patch.status, frame_end: patch.frameEnd, complexity: patch.complexity,
      due_date: patch.dueDate, thumbnail_path: patch.thumbnailPath, client_visible: patch.clientVisible,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteShot(id: string): Promise<void> {
  const { error } = await supabase.from("production_shots").delete().eq("id", id);
  if (error) throw error;
}
