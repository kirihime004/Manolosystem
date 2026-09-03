import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminContract, useContractRenewals, useAdminContractMutations, useAdminDocuments } from "@/features/admin/hooks";
import { getAdminDocumentUrl } from "@/features/admin/adminDocumentsApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function AdminContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const { company } = useCompany();
  const { data: contract, isLoading } = useAdminContract(contractId);
  const { data: renewals } = useContractRenewals(contractId);
  const { data: documents } = useAdminDocuments(company?.id, "ADMIN_CONTRACT", contractId);
  const { activate, renew, terminate } = useAdminContractMutations(company?.id, contractId);

  const [renewOpen, setRenewOpen] = useState(false);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newValue, setNewValue] = useState("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!contract) return <ErrorScreen title="Contract not found" description="This contract does not exist or you do not have access." />;

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleRenew = async (e: FormEvent) => {
    e.preventDefault();
    if (!contractId) return;
    try {
      await renew.mutateAsync({ id: contractId, newStartDate, newEndDate, newValue: newValue ? Number(newValue) : undefined });
      toast.success("Contract renewed");
      setRenewOpen(false); setNewStartDate(""); setNewEndDate(""); setNewValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to renew contract");
    }
  };

  const handleDownload = async (path: string) => {
    try {
      const url = await getAdminDocumentUrl(path);
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open document");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{contract.contract_name}</h1>
          <p className="text-sm text-muted-foreground">{contract.contract_number} · {contract.contract_type.replace(/_/g, " ")}</p>
        </div>
        <AdminStatusBadge status={contract.status} />
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Start date</p><p className="font-medium text-foreground">{contract.start_date}</p></div>
          <div><p className="text-xs text-muted-foreground">End date</p><p className="font-medium text-foreground">{contract.end_date}</p></div>
          <div><p className="text-xs text-muted-foreground">Value</p><p className="font-medium text-foreground">{contract.value ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Payment terms</p><p className="font-medium text-foreground">{contract.payment_terms ?? "—"}</p></div>
        </CardContent>
      </Card>

      {(renewals?.predecessor || renewals?.successor) && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          {renewals.predecessor && (
            <p className="text-muted-foreground">
              Renewed from <Link to={`../${renewals.predecessor.id}`} className="font-medium text-primary hover:underline">{renewals.predecessor.contract_number}</Link>
            </p>
          )}
          {renewals.successor && (
            <p className="text-muted-foreground">
              Renewed as <Link to={`../${renewals.successor.id}`} className="font-medium text-primary hover:underline">{renewals.successor.contract_number}</Link>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Can permission={PERMISSIONS.ADMIN_CONTRACTS_UPDATE}>
          {contract.status === "DRAFT" && (
            <Button size="sm" onClick={() => runAction(() => activate.mutateAsync(contract.id), "Contract activated")}>Activate</Button>
          )}
          {contract.status === "ACTIVE" && !renewals?.successor && (
            <Button size="sm" variant="outline" onClick={() => runAction(() => terminate.mutateAsync({ id: contract.id }), "Contract terminated")}>Terminate</Button>
          )}
        </Can>
        <Can permission={PERMISSIONS.ADMIN_CONTRACTS_RENEW}>
          {contract.status === "ACTIVE" && !renewals?.successor && (
            <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline">Renew</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Renew {contract.contract_number}</DialogTitle></DialogHeader>
                <form onSubmit={handleRenew} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>New start date</Label><Input type="date" required value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>New end date</Label><Input type="date" required value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>New value (optional)</Label><Input type="number" step="0.01" value={newValue} onChange={(e) => setNewValue(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={renew.isPending}>Renew</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </Can>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Documents</h3>
        <div className="rounded-lg border border-border bg-card">
          {!documents || documents.length === 0 ? (
            <EmptyState icon={FileText} title="No documents yet" />
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between p-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.document_type.replace(/_/g, " ")}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(d.storage_path)}>Download</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
