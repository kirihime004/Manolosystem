import { Link, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useDisposals } from "@/features/it/inventory/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";

export default function DisposalsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: disposals, isLoading } = useDisposals(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Disposal</h1>
        <p className="text-sm text-muted-foreground">{disposals?.length ?? 0} disposed assets — permanent record, nothing is deleted.</p>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !disposals || disposals.length === 0 ? (
          <EmptyState icon={Trash2} title="No disposed assets" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Disposal Date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Final Value</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disposals.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link to={`/c/${companySlug}/it/inventory/${d.asset?.asset_code}`} className="font-medium text-foreground hover:underline">
                      {d.asset?.asset_code} — {d.asset?.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(d.disposal_date).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary">{d.disposal_reason.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{d.disposal_method.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{d.final_value != null ? `${d.currency} ${d.final_value.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">{d.notes ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
