import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAttendance, useAttendanceMutations, useAttendanceCorrections, useAttendanceCorrectionMutations, useEmployees } from "@/features/hr/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceStatusBadge } from "@/components/shared/HrBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

export default function AttendancePage() {
  const { company } = useCompany();
  const today = new Date().toISOString().slice(0, 10);
  const { data: attendance, isLoading } = useAttendance(company?.id, { from: today, to: today });
  const { data: employees } = useEmployees(company?.id);
  const { record } = useAttendanceMutations(company?.id);
  const { data: corrections, isLoading: loadingCorrections } = useAttendanceCorrections(company?.id);
  const { decide } = useAttendanceCorrectionMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("PRESENT");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !employeeId) return;
    try {
      await record.mutateAsync({
        companyId: company.id, employeeId, attendanceDate: today, status: status as never,
        clockIn: clockIn ? `${today}T${clockIn}:00` : null, clockOut: clockOut ? `${today}T${clockOut}:00` : null,
      });
      toast.success("Attendance recorded");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record attendance");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Today, {new Date().toLocaleDateString()}</p>
        </div>
        <Can permission={PERMISSIONS.HR_ATTENDANCE_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ Record attendance</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record attendance</DialogTitle></DialogHeader>
              <form onSubmit={handleRecord} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Employee</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "REMOTE", "REST_DAY"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Clock in</Label><Input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Clock out</Label><Input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} /></div>
                </div>
                <DialogFooter><Button type="submit" disabled={record.isPending || !employeeId}>Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <Tabs defaultValue="today">
        <TabsList><TabsTrigger value="today">Today</TabsTrigger><TabsTrigger value="corrections">Corrections</TabsTrigger></TabsList>

        <TabsContent value="today" className="pt-4">
          <div className="rounded-lg border border-border bg-card">
            {isLoading ? <div className="p-6"><Skeleton className="h-32 w-full" /></div> : !attendance || attendance.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No data available.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Clock In</TableHead><TableHead>Clock Out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{empMap.get(a.employee_id) ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.clock_in ? new Date(a.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.clock_out ? new Date(a.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{a.total_hours ?? "—"}</TableCell>
                      <TableCell><AttendanceStatusBadge status={a.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="corrections" className="pt-4">
          <div className="rounded-lg border border-border bg-card">
            {loadingCorrections ? <div className="p-6"><Skeleton className="h-32 w-full" /></div> : !corrections || corrections.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No data available.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {corrections.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{empMap.get(c.employee_id) ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.attendance_date}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{c.reason}</TableCell>
                      <TableCell>{c.status}</TableCell>
                      <TableCell>
                        {c.status === "PENDING" && (
                          <Can permission={PERMISSIONS.HR_ATTENDANCE_APPROVE}>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: c.id, decision: "APPROVED" })}>Approve</Button>
                              <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: c.id, decision: "REJECTED" })}>Reject</Button>
                            </div>
                          </Can>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
