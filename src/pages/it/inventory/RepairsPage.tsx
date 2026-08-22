import { Link, useParams } from "react-router-dom";
import { Wrench } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useRepairs } from "@/features/it/inventory/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { RepairStatusBadge } from "@/components/shared/AssetBadges";

export default function RepairsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: repairs, isLoading } = useRepairs(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Repairs</h1>
        <p className="text-sm text-muted-foreground">{repairs?.length ?? 0} repair records</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !repairs || repairs.length === 0 ? (
          <EmptyState icon={Wrench} title="No repair records" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repairs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to={`/c/${companySlug}/it/inventory/${r.asset?.asset_code}`} className="font-medium text-foreground hover:underline">
                      {r.asset?.asset_code} — {r.asset?.name}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{r.problem_description}</TableCell>
                  <TableCell className="text-muted-foreground">{r.repair_vendor ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.reported_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-muted-foreground">{r.expected_completion_date ? new Date(r.expected_completion_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.repair_cost != null ? `${r.currency} ${r.repair_cost.toLocaleString()}` : "—"}</TableCell>
                  <TableCell><RepairStatusBadge status={r.repair_status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
