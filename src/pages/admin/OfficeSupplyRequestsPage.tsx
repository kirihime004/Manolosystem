import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useOfficeSupplies, useOfficeSupplyRequests, useOfficeSupplyRequestMutations } from "@/features/admin/hooks";
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

export default function OfficeSupplyRequestsPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: supplies } = useOfficeSupplies(company?.id);
  const { data: requests, isLoading } = useOfficeSupplyRequests(company?.id);
  const { create, decide, issue } = useOfficeSupplyRequestMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [supplyId, setSupplyId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const supplyMap = new Map((supplies ?? []).map((s) => [s.id, s.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee || !supplyId) return;
    try {
      await create.mutateAsync({ companyId: company!.id, requesterId: myEmployee.id, supplyId, quantityRequested: Number(quantity) });
      toast.success("Request submitted");
      setOpen(false); setSupplyId(""); setQuantity("1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Supply Requests</h1>
          <p className="text-sm text-muted-foreground">Request office supplies for your team</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!myEmployee}>+ New request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request office supplies</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Item</Label>
                <Select value={supplyId} onValueChange={setSupplyId}>
                  <SelectTrigger><SelectValue placeholder="Select an item" /></SelectTrigger>
                  <SelectContent>{(supplies ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={create.isPending || !supplyId}>Submit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !requests || requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No requests yet" description="Submit your first supply request." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Item</TableHead><TableHead>Quantity</TableHead><TableHead>Status</TableHead><TableHead className="w-40" /></TableRow></TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.request_number}</TableCell>
                  <TableCell className="font-medium">{supplyMap.get(r.supply_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.quantity_requested}</TableCell>
                  <TableCell><AdminStatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_SUPPLIES_ISSUE}>
                      {r.status === "SUBMITTED" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => decide.mutate({ id: r.id, approve: true })}>Approve</Button>
                          <Button variant="ghost" size="sm" onClick={() => decide.mutate({ id: r.id, approve: false })}>Reject</Button>
                        </div>
                      )}
                      {r.status === "APPROVED" && <Button variant="ghost" size="sm" onClick={() => issue.mutate(r.id)}>Issue</Button>}
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
