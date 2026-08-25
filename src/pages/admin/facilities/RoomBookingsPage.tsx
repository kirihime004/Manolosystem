import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useRooms, useRoomBookings, useRoomBookingMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";

export default function RoomBookingsPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: rooms } = useRooms(company?.id);
  const { data: bookings, isLoading } = useRoomBookings(company?.id);
  const { create } = useRoomBookingMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [purpose, setPurpose] = useState("");

  const roomMap = new Map((rooms ?? []).map((r) => [r.id, r.name]));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee || !roomId) return;
    try {
      await create.mutateAsync({ companyId: company!.id, roomId, requesterId: myEmployee.id, bookingDate: date, startTime, endTime, purpose: purpose || null });
      toast.success("Room booked");
      setOpen(false); setRoomId(""); setDate(""); setPurpose("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "This room is already booked for that time");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Room Bookings</h1>
          <p className="text-sm text-muted-foreground">Reserve a room — overlapping bookings are rejected automatically</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!myEmployee}>+ Book a room</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Book a room</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Room</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger><SelectValue placeholder="Select a room" /></SelectTrigger>
                  <SelectContent>{(rooms ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start time</Label><Input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>End time</Label><Input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Purpose</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={create.isPending || !roomId}>Book room</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !bookings || bookings.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No bookings yet" description="Book a room to get started." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{roomMap.get(b.room_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.booking_date}</TableCell>
                  <TableCell className="text-muted-foreground">{b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</TableCell>
                  <TableCell className="text-muted-foreground">{b.purpose ?? "—"}</TableCell>
                  <TableCell><AdminStatusBadge status={b.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
