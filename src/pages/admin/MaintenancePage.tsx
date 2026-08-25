import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAdminAssets, useRooms, useMaintenanceRecords, useMaintenanceMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge, AdminPriorityBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { MaintenanceRecord } from "@/types/database";

export default function MaintenancePage() {
  const { company } = useCompany();
  const { data: records, isLoading } = useMaintenanceRecords(company?.id);
  const { data: assets } = useAdminAssets(company?.id);
  const { data: rooms } = useRooms(company?.id);
  const { create, complete, cancel } = useMaintenanceMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [issue, setIssue] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const assetMap = new Map((assets ?? []).map((a) => [a.id, a.name]));
  const roomMap = new Map((rooms ?? []).map((r) => [r.id, r.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, assetId: assetId || null, roomId: !assetId ? roomId || null : null, issue, priority });
      toast.success("Maintenance reported");
      setOpen(false); setAssetId(""); setRoomId(""); setIssue(""); setPriority("MEDIUM");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report issue");
    }
  };

  const handleComplete = async (r: MaintenanceRecord) => {
    try {
      await complete.mutateAsync({ id: r.id });
      toast.success("Marked complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Maintenance</h1>
          <p className="text-sm text-muted-foreground">Repairs and upkeep for Admin-owned assets and facilities</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ Report issue</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Report a maintenance issue</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Asset (optional)</Label>
                  <Select value={assetId} onValueChange={setAssetId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{(assets ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!assetId && (
                  <div className="space-y-1.5">
                    <Label>Room (optional)</Label>
                    <Select value={roomId} onValueChange={setRoomId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(rooms ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5"><Label>Issue</Label><Textarea required rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Report issue</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !records || records.length === 0 ? (
          <EmptyState icon={Wrench} title="No maintenance records" description="Report an issue to get started." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Item</TableHead><TableHead>Issue</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.maintenance_number}</TableCell>
                  <TableCell className="text-muted-foreground">{r.asset_id ? assetMap.get(r.asset_id) : r.room_id ? roomMap.get(r.room_id) : "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.issue}</TableCell>
                  <TableCell><AdminPriorityBadge priority={r.priority} /></TableCell>
                  <TableCell><AdminStatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_COMPLETE}>
                      {!["COMPLETED", "CANCELLED"].includes(r.status) && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleComplete(r)}>Complete</Button>
                          <Button variant="ghost" size="sm" onClick={() => cancel.mutate({ id: r.id })}>Cancel</Button>
                        </div>
                      )}
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
