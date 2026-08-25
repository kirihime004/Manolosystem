import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useCourierMail, useCourierMailMutations } from "@/features/admin/hooks";
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

export default function CourierPage() {
  const { company } = useCompany();
  const { data: items, isLoading } = useCourierMail(company?.id);
  const { create, updateStatus } = useCourierMailMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState("INCOMING");
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, direction, sender: sender || null, recipient: recipient || null, trackingNumber: trackingNumber || null });
      toast.success("Logged");
      setOpen(false); setSender(""); setRecipient(""); setTrackingNumber("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log item");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Courier / Mail</h1>
          <p className="text-sm text-muted-foreground">Incoming and outgoing deliveries</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_COURIER_MANAGE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ Log item</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log courier / mail item</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="INCOMING">Incoming</SelectItem><SelectItem value="OUTGOING">Outgoing</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Sender</Label><Input value={sender} onChange={(e) => setSender(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Recipient</Label><Input value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Tracking number</Label><Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Log item</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !items || items.length === 0 ? (
          <EmptyState icon={Truck} title="Nothing logged yet" description="Log your first courier or mail item." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Direction</TableHead><TableHead>Sender</TableHead><TableHead>Recipient</TableHead><TableHead>Tracking</TableHead><TableHead>Status</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-muted-foreground">{i.direction}</TableCell>
                  <TableCell>{i.sender ?? "—"}</TableCell>
                  <TableCell>{i.recipient ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{i.tracking_number ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={i.status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.ADMIN_COURIER_MANAGE}>
                      {i.status !== "DELIVERED" && i.status !== "CANCELLED" && (
                        <Button variant="ghost" size="sm" onClick={() => updateStatus.mutate({ id: i.id, status: "DELIVERED" })}>Mark delivered</Button>
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
