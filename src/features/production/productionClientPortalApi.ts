import { supabase } from "@/lib/supabase/client";
import type { ProductionClientUser, ProductionProject, ProductionShot, ProductionVersion, ProductionDeliverable } from "@/types/database";

// Every read below relies entirely on the client-scoped RLS policies
// added in migration 142 -- no company_id/customer_id filter is applied
// client-side, since a client user's session can only ever see rows RLS
// already restricts to their own customer's portal-enabled projects.

export async function getMyClientProfile(): Promise<ProductionClientUser | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from("production_client_users").select("*").eq("user_id", auth.user.id).maybeSingle();
  if (error) throw error;
  return data as ProductionClientUser | null;
}

export async function listMyProjects(): Promise<ProductionProject[]> {
  const { data, error } = await supabase.from("production_projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionProject[];
}

export async function listMyProjectShots(projectId: string): Promise<ProductionShot[]> {
  const { data, error } = await supabase.from("production_shots").select("*").eq("project_id", projectId).order("shot_number");
  if (error) throw error;
  return data as ProductionShot[];
}

export async function listMyShotVersions(shotId: string): Promise<ProductionVersion[]> {
  const { data, error } = await supabase.from("production_versions").select("*").eq("shot_id", shotId).order("version_number", { ascending: false });
  if (error) throw error;
  return data as ProductionVersion[];
}

export async function listMyDeliverables(projectId: string): Promise<ProductionDeliverable[]> {
  const { data, error } = await supabase.from("production_deliverables").select("*").eq("project_id", projectId).order("due_date");
  if (error) throw error;
  return data as ProductionDeliverable[];
}
