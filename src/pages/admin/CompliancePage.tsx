import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminComplianceList, useAdminComplianceMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function CompliancePage() {
  const { company } = useCompany();
  const { data: records, isLoading } = useAdminComplianceList(company?.id);
  const { create } = useAdminComplianceMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [name, setName] = useState("");
  const [authority, setAuthority] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, type, name, authority: authority || null, expiryDate: expiryDate || null });
      toast.success("Compliance record created");
      setOpen(false); setType(""); setName(""); setAuthority(""); setExpiryDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create record");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Compliance</h1>
          <p className="text-sm text-muted-foreground">Permits, licenses, and inspections</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_COMPLIANCE_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New record</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New compliance record</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Type</Label><Input required value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Business Permit" /></div>
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Authority</Label><Input value={authority} onChange={(e) => setAuthority(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Expiry date</Label><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create record</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !records || records.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No compliance records yet" description="Track your first permit or license." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.compliance_number}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.type}</TableCell>
                  <TableCell className="text-muted-foreground">{r.expiry_date ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
