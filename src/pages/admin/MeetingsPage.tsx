import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord } from "@/features/hr/hooks";
import { useRooms, useMeetings, useMeetingMutations } from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";

export default function MeetingsPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: rooms } = useRooms(company?.id);
  const { data: meetings, isLoading } = useMeetings(company?.id);
  const { schedule, cancel } = useMeetingMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) return;
    try {
      await schedule.mutateAsync({ companyId: company!.id, organizerId: myEmployee.id, title, meetingDate, startTime, endTime, roomId: roomId || null });
      toast.success("Meeting scheduled");
      setOpen(false); setTitle(""); setRoomId(""); setMeetingDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That room is already booked for this time");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Meetings</h1>
          <p className="text-sm text-muted-foreground">Internal meetings and room reservations</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={!myEmployee}>+ Schedule meeting</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule a meeting</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Room (optional)</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger><SelectValue placeholder="No room" /></SelectTrigger>
                  <SelectContent>{(rooms ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start</Label><Input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>End</Label><Input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
              </div>
              <DialogFooter><Button type="submit" disabled={schedule.isPending}>Schedule</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !meetings || meetings.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No meetings yet" description="Schedule your first meeting." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Room</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Status</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {meetings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell className="text-muted-foreground">{m.room_booking_id ? "Booked" : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.meeting_date}</TableCell>
                  <TableCell className="text-muted-foreground">{m.start_time.slice(0, 5)} – {m.end_time.slice(0, 5)}</TableCell>
                  <TableCell><AdminStatusBadge status={m.status} /></TableCell>
                  <TableCell>{m.status === "SCHEDULED" && <Button variant="ghost" size="sm" onClick={() => cancel.mutate(m.id)}>Cancel</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
