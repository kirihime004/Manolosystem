import { supabase } from "@/lib/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabase/functionError";
import type { AiAlert, AiCompanySettings, AiConversation, AiMessage, AiUsageSummaryRow, AnalyticsSnapshot, CompanyAiContext, MetricForecast } from "@/types/database";

export async function listConversations(companyId: string): Promise<AiConversation[]> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as AiConversation[];
}

export async function createConversation(companyId: string, userId: string): Promise<AiConversation> {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ company_id: companyId, user_id: userId, title: "New conversation" })
    .select("*")
    .single();
  if (error) throw error;
  return data as AiConversation;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase.from("ai_conversations").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function listMessages(conversationId: string): Promise<AiMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as AiMessage[];
}

// The only call that leaves the browser's direct Supabase connection --
// routed through the ai-chat Edge Function, which holds OPENROUTER_API_KEY
// server-side and never returns it or any other secret to the client.
export async function sendMessage(input: { companyId: string; conversationId: string; message: string }): Promise<AiMessage> {
  const { data, error } = await supabase.functions.invoke("ai-chat", { body: input });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  return (data as { message: AiMessage }).message;
}

export async function getCompanyAiContext(companyId: string): Promise<CompanyAiContext> {
  const { data, error } = await supabase.rpc("get_company_ai_context", { p_company_id: companyId });
  if (error) throw error;
  return data as CompanyAiContext;
}

export async function getAiCompanySettings(companyId: string): Promise<AiCompanySettings | null> {
  const { data, error } = await supabase.from("ai_company_settings").select("*").eq("company_id", companyId).maybeSingle();
  if (error) throw error;
  return data as AiCompanySettings | null;
}

export async function upsertAiCompanySettings(companyId: string, patch: Partial<Omit<AiCompanySettings, "company_id" | "updated_at">>): Promise<void> {
  const { error } = await supabase.from("ai_company_settings").upsert({ company_id: companyId, ...patch }, { onConflict: "company_id" });
  if (error) throw error;
}

export async function listOpenAlerts(companyId: string): Promise<AiAlert[]> {
  const { data, error } = await supabase
    .from("ai_alerts")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AiAlert[];
}

export async function scanForAlerts(companyId: string): Promise<AiAlert[]> {
  const { data, error } = await supabase.rpc("scan_for_ai_alerts", { p_company_id: companyId });
  if (error) throw error;
  return data as AiAlert[];
}

export async function acknowledgeAlert(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from("ai_alerts").update({ status: "ACKNOWLEDGED", acknowledged_by: userId, acknowledged_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function resolveAlert(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from("ai_alerts").update({ status: "RESOLVED", resolved_by: userId, resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function captureDailySnapshot(companyId: string): Promise<void> {
  const { error } = await supabase.rpc("capture_daily_snapshot", { p_company_id: companyId });
  if (error) throw error;
}

export async function getAiUsageSummary(companyId: string, days = 30): Promise<AiUsageSummaryRow[]> {
  const { data, error } = await supabase.rpc("get_ai_usage_summary", { p_company_id: companyId, p_days: days });
  if (error) throw error;
  return data as AiUsageSummaryRow[];
}

export async function getMetricForecast(companyId: string, module: string, metric: string): Promise<MetricForecast> {
  const { data, error } = await supabase.rpc("get_metric_forecast", { p_company_id: companyId, p_module: module, p_metric: metric });
  if (error) throw error;
  return data as MetricForecast;
}

export async function listSnapshots(companyId: string, days = 30): Promise<AnalyticsSnapshot[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from("analytics_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .gte("snapshot_date", since.toISOString().slice(0, 10))
    .order("snapshot_date", { ascending: true });
  if (error) throw error;
  return data as AnalyticsSnapshot[];
}
