import { supabase } from "@/lib/supabase/client";
import type {
  ProductionProject, ProductionProjectMember, ProductionShow, ProductionEpisode,
  ProductionSequence, ProductionSettings, ProductionProjectTemplate,
} from "@/types/database";

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------
export async function getProductionSettings(companyId: string): Promise<ProductionSettings> {
  const { data, error } = await supabase.from("production_settings").select("*").eq("company_id", companyId).single();
  if (error) throw error;
  return data as ProductionSettings;
}

export async function updateProductionSettings(companyId: string, patch: Partial<{ shotNamingFormat: string }>): Promise<void> {
  const { error } = await supabase.from("production_settings").update({ shot_naming_format: patch.shotNamingFormat }).eq("company_id", companyId);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------
export async function listProjects(companyId: string, status?: string): Promise<ProductionProject[]> {
  let query = supabase.from("production_projects").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionProject[];
}

export async function getProject(id: string): Promise<ProductionProject> {
  const { data, error } = await supabase.from("production_projects").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProductionProject;
}

export async function createProject(input: {
  companyId: string; name: string; projectType: string; description?: string | null; clientId?: string | null;
  departmentId?: string | null; directorId?: string | null; producerId?: string | null;
  startDate?: string | null; targetEndDate?: string | null; currencyId?: string | null;
}): Promise<ProductionProject> {
  const { data, error } = await supabase
    .from("production_projects")
    .insert({
      company_id: input.companyId, name: input.name, project_type: input.projectType, description: input.description ?? null,
      client_id: input.clientId ?? null, department_id: input.departmentId ?? null, director_id: input.directorId ?? null,
      producer_id: input.producerId ?? null, start_date: input.startDate ?? null, target_end_date: input.targetEndDate ?? null,
      currency_id: input.currencyId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionProject;
}

export async function updateProject(id: string, patch: Partial<{
  name: string; description: string | null; status: string; directorId: string | null; producerId: string | null;
  startDate: string | null; targetEndDate: string | null; actualEndDate: string | null; notes: string | null;
  budgetId: string | null; clientPortalEnabled: boolean;
}>): Promise<void> {
  const { error } = await supabase
    .from("production_projects")
    .update({
      name: patch.name, description: patch.description, status: patch.status, director_id: patch.directorId,
      producer_id: patch.producerId, start_date: patch.startDate, target_end_date: patch.targetEndDate,
      actual_end_date: patch.actualEndDate, notes: patch.notes, budget_id: patch.budgetId,
      client_portal_enabled: patch.clientPortalEnabled,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("production_projects").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Project members
// ---------------------------------------------------------------------
export async function listProjectMembers(projectId: string): Promise<ProductionProjectMember[]> {
  const { data, error } = await supabase.from("production_project_members").select("*").eq("project_id", projectId).order("added_at");
  if (error) throw error;
  return data as ProductionProjectMember[];
}

export async function addProjectMember(input: { companyId: string; projectId: string; employeeId: string; projectRole: string; department?: string | null }): Promise<ProductionProjectMember> {
  const { data, error } = await supabase
    .from("production_project_members")
    .insert({ company_id: input.companyId, project_id: input.projectId, employee_id: input.employeeId, project_role: input.projectRole, department: input.department ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionProjectMember;
}

export async function removeProjectMember(id: string): Promise<void> {
  const { error } = await supabase.from("production_project_members").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Shows / Episodes / Sequences
// ---------------------------------------------------------------------
export async function listShows(projectId: string): Promise<ProductionShow[]> {
  const { data, error } = await supabase.from("production_shows").select("*").eq("project_id", projectId).order("name");
  if (error) throw error;
  return data as ProductionShow[];
}

export async function createShow(input: { companyId: string; projectId: string; name: string; description?: string | null }): Promise<ProductionShow> {
  const { data, error } = await supabase
    .from("production_shows")
    .insert({ company_id: input.companyId, project_id: input.projectId, name: input.name, description: input.description ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionShow;
}

export async function listEpisodes(projectId: string): Promise<ProductionEpisode[]> {
  const { data, error } = await supabase.from("production_episodes").select("*").eq("project_id", projectId).order("episode_number");
  if (error) throw error;
  return data as ProductionEpisode[];
}

export async function createEpisode(input: { companyId: string; projectId: string; showId?: string | null; episodeNumber: number; name?: string | null; airDate?: string | null }): Promise<ProductionEpisode> {
  const { data, error } = await supabase
    .from("production_episodes")
    .insert({ company_id: input.companyId, project_id: input.projectId, show_id: input.showId ?? null, episode_number: input.episodeNumber, name: input.name ?? null, air_date: input.airDate ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionEpisode;
}

export async function updateEpisode(id: string, patch: Partial<{ name: string | null; status: string; airDate: string | null }>): Promise<void> {
  const { error } = await supabase.from("production_episodes").update({ name: patch.name, status: patch.status, air_date: patch.airDate }).eq("id", id);
  if (error) throw error;
}

export async function listSequences(projectId: string, episodeId?: string | null): Promise<ProductionSequence[]> {
  let query = supabase.from("production_sequences").select("*").eq("project_id", projectId).order("sequence_number");
  if (episodeId) query = query.eq("episode_id", episodeId);
  const { data, error } = await query;
  if (error) throw error;
  return data as ProductionSequence[];
}

export async function createSequence(input: { companyId: string; projectId: string; episodeId?: string | null; sequenceNumber: number; name?: string | null; description?: string | null }): Promise<ProductionSequence> {
  const { data, error } = await supabase
    .from("production_sequences")
    .insert({ company_id: input.companyId, project_id: input.projectId, episode_id: input.episodeId ?? null, sequence_number: input.sequenceNumber, name: input.name ?? null, description: input.description ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionSequence;
}

export async function updateSequence(id: string, patch: Partial<{ name: string | null; description: string | null; status: string }>): Promise<void> {
  const { error } = await supabase.from("production_sequences").update({ name: patch.name, description: patch.description, status: patch.status }).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Project templates
// ---------------------------------------------------------------------
export async function listProjectTemplates(companyId: string): Promise<ProductionProjectTemplate[]> {
  const { data, error } = await supabase.from("production_project_templates").select("*").eq("company_id", companyId).order("name");
  if (error) throw error;
  return data as ProductionProjectTemplate[];
}

export async function createProjectTemplate(input: { companyId: string; name: string; projectType?: string | null; description?: string | null; config?: Record<string, unknown> }): Promise<ProductionProjectTemplate> {
  const { data, error } = await supabase
    .from("production_project_templates")
    .insert({ company_id: input.companyId, name: input.name, project_type: input.projectType ?? null, description: input.description ?? null, config: input.config ?? {} })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProductionProjectTemplate;
}

export async function applyProjectTemplate(projectId: string, templateId: string): Promise<void> {
  const { error } = await supabase.rpc("apply_production_project_template", { p_project_id: projectId, p_template_id: templateId });
  if (error) throw error;
}

export async function getProductionBudgetSummary(projectId: string) {
  const { data, error } = await supabase.rpc("get_production_budget_summary", { p_project_id: projectId });
  if (error) throw error;
  return data?.[0] ?? null;
}
