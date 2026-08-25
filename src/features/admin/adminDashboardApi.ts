import { supabase } from "@/lib/supabase/client";
import type { AdminDashboardSummary } from "@/types/database";

export async function getAdminDashboardSummary(companyId: string): Promise<AdminDashboardSummary> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_summary", { p_company_id: companyId }).single();
  if (error) throw error;
  return data as AdminDashboardSummary;
}
