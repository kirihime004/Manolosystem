import { supabase } from "@/lib/supabase/client";

export interface AuditLogEntry {
  id: string;
  company_id: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: { first_name: string | null; last_name: string | null } | null;
}

export interface AuditLogFilters {
  action?: string;
  resourceType?: string;
  limit?: number;
}

// audit_logs is append-only (see 20260101000009_audit_logs.sql -- no update
// or delete policy exists at all) and RLS-scoped to ADMIN.AUDIT.VIEW, so
// this is a plain company-scoped read, same shape as
// listProcurementHistory. `action`/`resourceType` are free text set by
// whatever logged the event (no enum table backs them), so filters here
// are substring/equality matches against what's actually on record, not a
// fixed option list.
export async function listAuditLogs(companyId: string, filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  let query = supabase.from("audit_logs").select("*").eq("company_id", companyId);
  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.resourceType) query = query.eq("resource_type", filters.resourceType);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(filters.limit ?? 100);
  if (error) throw error;

  const rows = data as Omit<AuditLogEntry, "actor">[];
  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => !!id))];
  let actorMap = new Map<string, { first_name: string | null; last_name: string | null }>();
  if (actorIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", actorIds);
    if (profileError) throw profileError;
    actorMap = new Map(profiles.map((p) => [p.id, { first_name: p.first_name, last_name: p.last_name }]));
  }

  return rows.map((r) => ({ ...r, actor: r.actor_user_id ? (actorMap.get(r.actor_user_id) ?? null) : null }));
}

// Distinct resource types actually on record for this company, to populate
// the filter dropdown with real values instead of a guessed enum.
export async function listAuditLogResourceTypes(companyId: string): Promise<string[]> {
  const { data, error } = await supabase.from("audit_logs").select("resource_type").eq("company_id", companyId);
  if (error) throw error;
  return [...new Set((data as { resource_type: string }[]).map((r) => r.resource_type))].sort();
}
