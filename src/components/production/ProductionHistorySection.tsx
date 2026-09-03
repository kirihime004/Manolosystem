import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useProductionHistory } from "@/features/production/hooks";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import type { ProductionHistoryEntry } from "@/types/database";

function actorName(map: Map<string, string>, performedBy: string | null) {
  if (!performedBy) return "System";
  return map.get(performedBy) ?? "Someone";
}

// Read-only activity trail, backed by the same production_history table the
// (already-closed) Audit Log viewer reads for company-wide events -- this is
// the per-resource slice of it, written by existing DB triggers on status
// changes/reassignment/version submission/review decisions. No filter bar
// or pagination: listHistory() isn't paginated and a single resource's
// history is small enough to just show in full.
export function ProductionHistorySection({ resourceType, resourceId }: { resourceType: ProductionHistoryEntry["resource_type"]; resourceId: string }) {
  const { company } = useCompany();
  const { data: employees } = useEmployees(company?.id);
  const { data: entries, isLoading } = useProductionHistory(resourceType, resourceId);

  const actorMap = new Map((employees ?? []).filter((e) => e.user_id).map((e) => [e.user_id as string, `${e.first_name} ${e.last_name}`]));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">History</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((h) => (
            <li key={h.id} className="rounded-md border border-border p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{h.event_type.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
              </div>
              {(h.previous_status || h.new_status) && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {h.previous_status && <ProductionStatusBadge status={h.previous_status} />}
                  {h.previous_status && h.new_status && <span className="text-muted-foreground">→</span>}
                  {h.new_status && <ProductionStatusBadge status={h.new_status} />}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{actorName(actorMap, h.performed_by)}</p>
              {h.notes && <p className="mt-0.5 text-xs text-muted-foreground">{h.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
