import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useOvertimeRequests, useOvertimeMutations, useMyEmployeeRecord, useEmployees, useOvertimeApprovals } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { OvertimeRequestStatusBadge } from "@/components/shared/HrBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function OvertimePage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: requests, isLoading } = useOvertimeRequests(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, submit, decide } = useOvertimeMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) { toast.error("No employee record is linked to your account"); return; }
    try {
      const ot = await create.mutateAsync({ employeeId: myEmployee.id, workDate, startTime: `${workDate}T${startTime}:00`, endTime: `${workDate}T${endTime}:00`, reason });
      await submit.mutateAsync(ot.id);
      toast.success(`${ot.request_number} submitted`);
      setOpen(false); setWorkDate(""); setStartTime(""); setEndTime(""); setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit overtime request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Overtime</h1>
          <p className="text-sm text-muted-foreground">{requests?.length ?? 0} requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Request overtime</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request overtime</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start time</Label><Input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>End time</Label><Input type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={create.isPending || !myEmployee}>Submit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !requests || requests.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {requests.map((ot) => (
                <TableRow key={ot.id}>
                  <TableCell className="font-mono text-xs">{ot.request_number}</TableCell>
                  <TableCell>{empMap.get(ot.employee_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{ot.work_date}</TableCell>
                  <TableCell>{ot.total_hours}</TableCell>
                  <TableCell><OvertimeRequestStatusBadge status={ot.status} /></TableCell>
                  <TableCell>
                    {ot.status === "SUBMITTED" && (
                      <Can permission={PERMISSIONS.HR_OVERTIME_APPROVE}>
                        <OvertimeApprovalActions overtimeRequestId={ot.id} decide={decide} />
                      </Can>
                    )}
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

function OvertimeApprovalActions({ overtimeRequestId, decide }: { overtimeRequestId: string; decide: ReturnType<typeof useOvertimeMutations>["decide"] }) {
  const { data: approvals } = useOvertimeApprovals(overtimeRequestId);
  const pending = approvals?.find((a) => a.decision === "PENDING");
  if (!pending) return null;
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => decide.mutate({ approvalId: pending.id, decision: "APPROVED" })}>Approve</Button>
      <Button size="sm" variant="ghost" onClick={() => decide.mutate({ approvalId: pending.id, decision: "REJECTED" })}>Reject</Button>
    </div>
  );
}
