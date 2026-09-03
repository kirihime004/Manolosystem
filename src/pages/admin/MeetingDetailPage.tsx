import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useEmployees } from "@/features/hr/hooks";
import { useMeeting, useMeetingParticipants, useMeetingMutations } from "@/features/admin/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { AdminStatusBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function MeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const { company } = useCompany();
  const { data: meeting, isLoading } = useMeeting(meetingId);
  const { data: participants } = useMeetingParticipants(meetingId);
  const { data: employees } = useEmployees(company?.id);
  const { cancel, complete, addParticipant } = useMeetingMutations(company?.id);

  const [addOpen, setAddOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const participantIds = new Set((participants ?? []).map((p) => p.employee_id));
  const availableEmployees = (employees ?? []).filter((e) => !participantIds.has(e.id));

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!meeting) return <ErrorScreen title="Meeting not found" description="This meeting does not exist or you do not have access." />;

  const handleAddParticipant = async (e: FormEvent) => {
    e.preventDefault();
    if (!meetingId || !employeeId) return;
    try {
      await addParticipant.mutateAsync({ companyId: company!.id, meetingId, employeeId });
      toast.success("Participant added");
      setAddOpen(false); setEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add participant");
    }
  };

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    try {
      await fn();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {meeting.meeting_date} · {meeting.start_time.slice(0, 5)} – {meeting.end_time.slice(0, 5)}
            {meeting.room_booking_id ? " · Room booked" : ""}
          </p>
        </div>
        <AdminStatusBadge status={meeting.status} />
      </div>

      {(meeting.purpose || meeting.agenda) && (
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm">
            {meeting.purpose && <div><p className="text-xs text-muted-foreground">Purpose</p><p className="text-foreground">{meeting.purpose}</p></div>}
            {meeting.agenda && <div><p className="text-xs text-muted-foreground">Agenda</p><p className="whitespace-pre-wrap text-foreground">{meeting.agenda}</p></div>}
          </CardContent>
        </Card>
      )}

      <Can permission={PERMISSIONS.ADMIN_MEETINGS_MANAGE}>
        <div className="flex gap-2">
          {meeting.status === "SCHEDULED" && (
            <>
              <Button size="sm" variant="outline" onClick={() => runAction(() => complete.mutateAsync(meeting.id), "Meeting completed")}>Mark completed</Button>
              <Button size="sm" variant="ghost" onClick={() => runAction(() => cancel.mutateAsync(meeting.id), "Meeting cancelled")}>Cancel</Button>
            </>
          )}
        </div>
      </Can>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Participants</h3>
          <Can permission={PERMISSIONS.ADMIN_MEETINGS_MANAGE}>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline">+ Add participant</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add participant</DialogTitle></DialogHeader>
                <form onSubmit={handleAddParticipant} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Employee</Label>
                    <Select value={employeeId} onValueChange={setEmployeeId}>
                      <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                      <SelectContent>{availableEmployees.map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <DialogFooter><Button type="submit" disabled={addParticipant.isPending || !employeeId}>Add</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
        <div className="rounded-lg border border-border bg-card">
          {!participants || participants.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No participants added yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium text-foreground">{employeeMap.get(p.employee_id) ?? "—"}</span>
                  <AdminStatusBadge status={p.response_status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
