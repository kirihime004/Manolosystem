import { supabase } from "@/lib/supabase/client";
import type { ProductionDashboardSummary, ProductionHistoryEntry } from "@/types/database";

export async function getProductionDashboardSummary(companyId: string): Promise<ProductionDashboardSummary> {
  const { data, error } = await supabase.rpc("get_production_dashboard_summary", { p_company_id: companyId });
  if (error) throw error;
  return data?.[0] as ProductionDashboardSummary;
}

export async function listHistory(resourceType: string, resourceId: string): Promise<ProductionHistoryEntry[]> {
  const { data, error } = await supabase
    .from("production_history")
    .select("*")
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductionHistoryEntry[];
}

export async function linkClientUser(input: { companyId: string; customerId: string; email: string; name: string }): Promise<string> {
  const { data, error } = await supabase.rpc("link_production_client_user", {
    p_company_id: input.companyId, p_customer_id: input.customerId, p_email: input.email, p_name: input.name,
  });
  if (error) throw error;
  return data as string;
}
