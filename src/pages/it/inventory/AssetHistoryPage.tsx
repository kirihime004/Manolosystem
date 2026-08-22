import { Link, useParams } from "react-router-dom";
import { History } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAssetHistory } from "@/features/it/inventory/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";

export default function AssetHistoryPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: history, isLoading } = useAssetHistory(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Asset History</h1>
        <p className="text-sm text-muted-foreground">Company-wide activity feed across every asset.</p>
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
                      <Link to={`/c/${companySlug}/it/inventory/${h.asset?.asset_code}`} className="text-muted-foreground hover:underline">
                        {h.asset?.asset_code} — {h.asset?.name}
                      </Link>
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                    {h.reason && <p className="mt-0.5 text-xs text-muted-foreground">Reason: {h.reason}</p>}
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
