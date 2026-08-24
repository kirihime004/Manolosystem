import { useState } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useTimesheets, useTimesheetMutations, useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { Timesheet } from "@/types/database";

export default function TimesheetsPage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: timesheets, isLoading } = useTimesheets(company?.id);
  const { data: employees } = useEmployees(company?.id);
  const { create, update, submit, decide, remove } = useTimesheetMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Timesheet | null>(null);
  const [workDate, setWorkDate] = useState("");
  const [projectName, setProjectName] = useState("");
  const [taskName, setTaskName] = useState("");
  const [hours, setHours] = useState("");

  const empMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const openCreate = () => { setEditing(null); setWorkDate(""); setProjectName(""); setTaskName(""); setHours(""); setOpen(true); };
  const openEdit = (t: Timesheet) => {
    setEditing(t); setWorkDate(t.work_date); setProjectName(t.project_name ?? ""); setTaskName(t.task_name ?? ""); setHours(String(t.hours));
    setOpen(true);
  };

  const handleSave = (submitNow: boolean) => async () => {
    if (editing) {
      try {
        await update.mutateAsync({ id: editing.id, patch: { workDate, projectName: projectName || null, taskName: taskName || null, hours: Number(hours) } });
        if (submitNow) await submit.mutateAsync(editing.id);
        toast.success(submitNow ? "Timesheet submitted" : "Draft saved");
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save timesheet");
      }
      return;
    }
    if (!myEmployee) { toast.error("No employee record is linked to your account"); return; }
    try {
      await create.mutateAsync({ employeeId: myEmployee.id, workDate, projectName: projectName || null, taskName: taskName || null, hours: Number(hours), submit: submitNow });
      toast.success(submitNow ? "Timesheet submitted" : "Draft saved");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save timesheet");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Timesheets</h1>
          <p className="text-sm text-muted-foreground">Prepares Production integration points (project/task) without duplicating a Production module</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}>+ Log time</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit timesheet" : "Log time"}</DialogTitle></DialogHeader>
            <form className="space-y-3">
              <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Project</Label><Input value={projectName} onChange={(e) => setProjectName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Task</Label><Input value={taskName} onChange={(e) => setTaskName(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Hours</Label><Input type="number" step="0.25" min="0" required value={hours} onChange={(e) => setHours(e.target.value)} /></div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={handleSave(false)} disabled={create.isPending || update.isPending}>Save as draft</Button>
                <Button type="button" onClick={handleSave(true)} disabled={create.isPending || update.isPending || (!editing && !myEmployee)}>Submit</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !timesheets || timesheets.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No data available.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Project</TableHead><TableHead>Task</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {timesheets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{empMap.get(t.employee_id) ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.work_date}</TableCell>
                  <TableCell className="text-muted-foreground">{t.project_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.task_name ?? "—"}</TableCell>
                  <TableCell>{t.hours}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell className="flex gap-2">
                    {t.status === "DRAFT" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => submit.mutate(t.id)}>Submit</Button>
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)}>Delete</Button>
                      </>
                    )}
                    {t.status === "SUBMITTED" && (
                      <Can permission={PERMISSIONS.HR_TIMESHEETS_APPROVE}>
                        <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: t.id, decision: "APPROVED" })}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: t.id, decision: "REJECTED" })}>Reject</Button>
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
