import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useDisposals, useDisposalMutations } from "@/features/it/inventory/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function DisposalsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const { data: disposals, isLoading } = useDisposals(company?.id);
  const { postAccountingEntry } = useDisposalMutations();

  const handlePostEntry = async (disposalId: string) => {
    if (!company) return;
    try {
      await postAccountingEntry.mutateAsync({ companyId: company.id, disposalId });
      toast.success("Accounting entry posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post accounting entry");
    }
  };

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
                <TableHead>Accounting</TableHead>
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
                  <TableCell>
                    {d.journal_entry_id ? (
                      <Link to={`/c/${companySlug}/finance/accounting/journals/${d.journal_entry_id}`} className="text-xs text-foreground underline underline-offset-2">
                        View entry
                      </Link>
                    ) : (
                      <Can permission={PERMISSIONS.FINANCE_JOURNALS_POST}>
                        <Button size="sm" variant="outline" onClick={() => handlePostEntry(d.id)} disabled={postAccountingEntry.isPending}>
                          Post entry
                        </Button>
                      </Can>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
