import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { DoorOpen } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useRooms, useRoomMutations } from "@/features/admin/hooks";
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

const TYPES = ["MEETING_ROOM", "CONFERENCE_ROOM", "TRAINING_ROOM", "STUDIO", "OFFICE", "RECEPTION", "KITCHEN", "STORAGE", "OTHER"];

export default function RoomsPage() {
  const { company } = useCompany();
  const { data: rooms, isLoading } = useRooms(company?.id);
  const { create } = useRoomMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("MEETING_ROOM");
  const [capacity, setCapacity] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, name, type, capacity: capacity ? Number(capacity) : null });
      toast.success("Room created");
      setOpen(false); setName(""); setType("MEETING_ROOM"); setCapacity("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create room");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Rooms</h1>
          <p className="text-sm text-muted-foreground">Meeting rooms, studios, and shared spaces</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_ROOMS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New room</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New room</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min="0" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create room</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !rooms || rooms.length === 0 ? (
          <EmptyState icon={DoorOpen} title="No rooms yet" description="Add your first room." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Capacity</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.room_code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{r.capacity ?? "—"}</TableCell>
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
