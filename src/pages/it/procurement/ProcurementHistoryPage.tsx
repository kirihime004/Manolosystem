import { Link, useParams } from "react-router-dom";
import { History } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useProcurementHistory } from "@/features/it/procurement/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

const RESOURCE_PATH: Record<string, string> = {
  purchase_request: "requests",
  quotation: "requests",
  purchase_order: "orders",
  delivery: "orders",
};

export default function ProcurementHistoryPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: history, isLoading } = useProcurementHistory(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Procurement History</h1>
        <p className="text-sm text-muted-foreground">Complete, permanent trail of every procurement event.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !history || history.length === 0 ? (
            <EmptyState icon={History} title="No history yet" />
          ) : (
            <ol className="space-y-4">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-foreground">
                      <span className="font-medium">{h.event_type.replace(/_/g, " ")}</span>{" "}
                      <Link to={`/c/${companySlug}/it/procurement/${RESOURCE_PATH[h.resource_type] ?? "history"}/${h.resource_id}`} className="text-muted-foreground hover:underline">
                        {h.resource_type.replace(/_/g, " ")}
                      </Link>
                    </p>
                    {(h.previous_status || h.new_status) && (
                      <p className="text-xs text-muted-foreground">{h.previous_status ?? "—"} → {h.new_status ?? "—"}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                    {h.notes && <p className="mt-0.5 text-xs text-muted-foreground">{h.notes}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
