import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FileSignature } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminContracts, useAdminContractMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const CONTRACT_TYPES = ["OFFICE_LEASE", "CLEANING", "SECURITY", "MAINTENANCE", "UTILITY", "VEHICLE_LEASE", "SERVICE", "OTHER"];

export default function ContractsPage() {
  const { company } = useCompany();
  const { data: contracts, isLoading } = useAdminContracts(company?.id);
  const { create, activate } = useAdminContractMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [contractName, setContractName] = useState("");
  const [contractType, setContractType] = useState("SERVICE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, contractName, contractType, startDate, endDate });
      toast.success("Contract created");
      setOpen(false); setContractName(""); setStartDate(""); setEndDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create contract");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Contracts</h1>
          <p className="text-sm text-muted-foreground">Office leases, service, and vendor contracts</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_CONTRACTS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New contract</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New contract</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Contract name</Label><Input required value={contractName} onChange={(e) => setContractName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CONTRACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>End date</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create contract</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !contracts || contracts.length === 0 ? (
          <EmptyState icon={FileSignature} title="No contracts yet" description="Add your first contract." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Ends</TableHead><TableHead>Status</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs"><Link to={c.id} className="hover:underline">{c.contract_number}</Link></TableCell>
                  <TableCell className="font-medium">{c.contract_name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.contract_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{c.end_date}</TableCell>
                  <TableCell><AdminStatusBadge status={c.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_CONTRACTS_UPDATE}>
                      {c.status === "DRAFT" && <Button variant="ghost" size="sm" onClick={() => activate.mutate(c.id)}>Activate</Button>}
                    </Can>
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
