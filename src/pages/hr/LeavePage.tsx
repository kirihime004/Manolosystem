import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import {
  useLeaveRequests, useLeaveMutations, useMyEmployeeRecord, useLeaveTypes, useEmployees, useLeaveApprovals,
} from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LeaveRequestStatusBadge } from "@/components/shared/HrBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export default function LeavePage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: leaveRequests, isLoading } = useLeaveRequests(company?.id);
  const { data: leaveTypes } = useLeaveTypes(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, submit, decide, cancel } = useLeaveMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));
  const typeMap = new Map((leaveTypes ?? []).map((t) => [t.id, t.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) { toast.error("No employee record is linked to your account"); return; }
    try {
      const lr = await create.mutateAsync({ employeeId: myEmployee.id, leaveTypeId, startDate, endDate, days: daysBetween(startDate, endDate), reason });
      await submit.mutateAsync(lr.id);
      toast.success(`${lr.request_number} submitted`);
      setOpen(false); setLeaveTypeId(""); setStartDate(""); setEndDate(""); setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit leave request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Leave</h1>
          <p className="text-sm text-muted-foreground">{leaveRequests?.length ?? 0} requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>+ Request leave</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request leave</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Leave type</Label>
                <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{(leaveTypes ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start date</Label><Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>End date</Label><Input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">{daysBetween(startDate, endDate)} day(s)</p>
              <div className="space-y-1.5"><Label>Reason</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={create.isPending || !myEmployee || !leaveTypeId}>Submit</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !leaveRequests || leaveRequests.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {leaveRequests.map((lr) => (
                <TableRow key={lr.id}>
                  <TableCell className="font-mono text-xs">{lr.request_number}</TableCell>
                  <TableCell>{empMap.get(lr.employee_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{typeMap.get(lr.leave_type_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{lr.start_date} → {lr.end_date}</TableCell>
                  <TableCell>{lr.days}</TableCell>
                  <TableCell><LeaveRequestStatusBadge status={lr.status} /></TableCell>
                  <TableCell className="flex items-center gap-2">
                    {lr.status === "SUBMITTED" && (
                      <Can permission={[PERMISSIONS.HR_LEAVE_APPROVE, PERMISSIONS.HR_LEAVE_REJECT]}>
                        <LeaveApprovalActions leaveRequestId={lr.id} decide={decide} />
                      </Can>
                    )}
                    {(lr.status === "DRAFT" || lr.status === "SUBMITTED") && (
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(lr.id)}>Cancel</Button>
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

function LeaveApprovalActions({ leaveRequestId, decide }: { leaveRequestId: string; decide: ReturnType<typeof useLeaveMutations>["decide"] }) {
  const { data: approvals } = useLeaveApprovals(leaveRequestId);
  const pending = approvals?.find((a) => a.decision === "PENDING");
  if (!pending) return null;
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => decide.mutate({ approvalId: pending.id, decision: "APPROVED" })}>Approve</Button>
      <Button size="sm" variant="ghost" onClick={() => decide.mutate({ approvalId: pending.id, decision: "REJECTED" })}>Reject</Button>
    </div>
  );
}
