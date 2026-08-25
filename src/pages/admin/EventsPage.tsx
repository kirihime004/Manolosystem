import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PartyPopper } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEvents, useEventMutations } from "@/features/admin/hooks";
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

const EVENT_TYPES = ["COMPANY_ANNIVERSARY", "CHRISTMAS_PARTY", "TEAM_BUILDING", "TRAINING_EVENT", "TOWN_HALL", "CLIENT_EVENT", "CORPORATE_EVENT", "OTHER"];

export default function EventsPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { company } = useCompany();
  const navigate = useNavigate();
  const { data: events, isLoading } = useEvents(company?.id);
  const { create } = useEventMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("CORPORATE_EVENT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, name, eventType, startDate, endDate });
      toast.success("Event created");
      setOpen(false); setName(""); setStartDate(""); setEndDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground">Company events and celebrations</p>
        </div>
        <Can permission={PERMISSIONS.ADMIN_EVENTS_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ New event</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>End date</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Create event</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !events || events.length === 0 ? (
          <EmptyState icon={PartyPopper} title="No events yet" description="Create your first event." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id} className="cursor-pointer" onClick={() => navigate(`/c/${companySlug}/admin/events/${ev.id}`)}>
                  <TableCell className="font-medium">{ev.name}</TableCell>
                  <TableCell className="text-muted-foreground">{ev.event_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{ev.start_date} – {ev.end_date}</TableCell>
                  <TableCell><AdminStatusBadge status={ev.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
