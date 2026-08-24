import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useEmploymentTypes, useEmploymentStatuses, useEmploymentConfigMutations,
  useLeaveTypes, useLeaveTypeMutations, useHolidays, useWorkSchedules, useScheduleHolidayMutations,
  useOnboardingTemplates, useOffboardingTemplates, useTaskTemplateMutations,
} from "@/features/hr/hooks";
import type {
  OnboardingTaskTemplate, OffboardingTaskTemplate, EmploymentType, EmploymentStatus, LeaveType, Holiday, WorkSchedule,
} from "@/types/database";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const ONBOARDING_DEPARTMENTS = ["HR", "IT", "ADMIN", "MANAGER"] as const;
const OFFBOARDING_DEPARTMENTS = ["HR", "IT", "ADMIN", "FINANCE", "MANAGER"] as const;
const WEEKDAYS = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" }, { value: 4, label: "Thu" },
  { value: 5, label: "Fri" }, { value: 6, label: "Sat" }, { value: 7, label: "Sun" },
];

export default function HrSettingsPage() {
  const { company } = useCompany();
  const templateMutations = useTaskTemplateMutations(company?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">HR Settings</h1>
        <p className="text-sm text-muted-foreground">Configure employment types, statuses, leave types, schedules, holidays, and onboarding/offboarding checklists -- companies are never locked into a hard-coded list.</p>
      </div>

      <Tabs defaultValue="types">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="types">Employment Types</TabsTrigger>
          <TabsTrigger value="statuses">Employment Statuses</TabsTrigger>
          <TabsTrigger value="leave">Leave Types</TabsTrigger>
          <TabsTrigger value="schedules">Work Schedules</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding Checklist</TabsTrigger>
          <TabsTrigger value="offboarding">Offboarding Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="pt-4"><EmploymentTypesTab companyId={company?.id} /></TabsContent>
        <TabsContent value="statuses" className="pt-4"><EmploymentStatusesTab companyId={company?.id} /></TabsContent>
        <TabsContent value="leave" className="pt-4"><LeaveTypesTab companyId={company?.id} /></TabsContent>
        <TabsContent value="schedules" className="pt-4"><WorkSchedulesTab companyId={company?.id} /></TabsContent>
        <TabsContent value="holidays" className="pt-4"><HolidaysTab companyId={company?.id} /></TabsContent>
        <TabsContent value="onboarding" className="pt-4">
          <TaskTemplatesTab
            departments={ONBOARDING_DEPARTMENTS}
            companyId={company?.id}
            list={useOnboardingTemplates(company?.id)}
            create={templateMutations.createOnboarding}
            update={templateMutations.updateOnboarding}
            remove={templateMutations.deleteOnboarding}
          />
        </TabsContent>
        <TabsContent value="offboarding" className="pt-4">
          <TaskTemplatesTab
            departments={OFFBOARDING_DEPARTMENTS}
            companyId={company?.id}
            list={useOffboardingTemplates(company?.id)}
            create={templateMutations.createOffboarding}
            update={templateMutations.updateOffboarding}
            remove={templateMutations.deleteOffboarding}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmploymentTypesTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useEmploymentTypes(companyId);
  const { createType, updateType, setTypeStatus, deleteType } = useEmploymentConfigMutations(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmploymentType | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EmploymentType | null>(null);

  const openCreate = () => { setEditing(null); setCode(""); setLabel(""); setOpen(true); };
  const openEdit = (t: EmploymentType) => { setEditing(t); setCode(t.code); setLabel(t.label); setOpen(true); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateType.mutateAsync({ id: editing.id, patch: { label, code: code.toUpperCase().replace(/\s+/g, "_") } });
        toast.success("Employment type updated");
      } else {
        await createType.mutateAsync({ code: code.toUpperCase().replace(/\s+/g, "_"), label });
        toast.success("Employment type added");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save employment type");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteType.mutateAsync(deleteTarget.id);
      toast.success("Employment type deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete -- it may still be assigned to employees");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={openCreate}>+ Add type</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit employment type" : "New employment type"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Label</Label><Input required value={label} onChange={(e) => setLabel(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SEASONAL" /></div>
            <DialogFooter><Button type="submit" disabled={createType.isPending || updateType.isPending}>{editing ? "Save changes" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.code}</TableCell>
                  <TableCell>
                    <Switch checked={t.status === "ACTIVE"} onCheckedChange={(v) => setTypeStatus.mutate({ id: t.id, status: v ? "ACTIVE" : "INACTIVE" })} />
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(t)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteTarget?.label}"?</AlertDialogTitle><AlertDialogDescription>Employees using this type will have it cleared. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmploymentStatusesTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useEmploymentStatuses(companyId);
  const { createStatus, updateStatus, setStatusStatus, deleteStatus } = useEmploymentConfigMutations(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmploymentStatus | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [isActiveEmployment, setIsActiveEmployment] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EmploymentStatus | null>(null);

  const openCreate = () => { setEditing(null); setCode(""); setLabel(""); setIsActiveEmployment(true); setOpen(true); };
  const openEdit = (s: EmploymentStatus) => { setEditing(s); setCode(s.code); setLabel(s.label); setIsActiveEmployment(s.is_active_employment); setOpen(true); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateStatus.mutateAsync({ id: editing.id, patch: { label, code: code.toUpperCase().replace(/\s+/g, "_"), is_active_employment: isActiveEmployment } });
        toast.success("Employment status updated");
      } else {
        await createStatus.mutateAsync({ code: code.toUpperCase().replace(/\s+/g, "_"), label, isActiveEmployment });
        toast.success("Employment status added");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save employment status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStatus.mutateAsync(deleteTarget.id);
      toast.success("Employment status deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete -- it may still be assigned to employees");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={openCreate}>+ Add status</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit employment status" : "New employment status"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Label</Label><Input required value={label} onChange={(e) => setLabel(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={isActiveEmployment} onCheckedChange={setIsActiveEmployment} /><Label>Counts as active employment</Label></div>
            <DialogFooter><Button type="submit" disabled={createStatus.isPending || updateStatus.isPending}>{editing ? "Save changes" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Code</TableHead><TableHead>Active employment</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.code}</TableCell>
                  <TableCell className="text-muted-foreground">{s.is_active_employment ? "Yes" : "No"}</TableCell>
                  <TableCell><Switch checked={s.status === "ACTIVE"} onCheckedChange={(v) => setStatusStatus.mutate({ id: s.id, status: v ? "ACTIVE" : "INACTIVE" })} /></TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(s)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteTarget?.label}"?</AlertDialogTitle><AlertDialogDescription>Employees using this status will have it cleared. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LeaveTypesTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useLeaveTypes(companyId);
  const { create, update, remove } = useLeaveTypeMutations(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [entitlement, setEntitlement] = useState("0");
  const [isPaid, setIsPaid] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);

  const openCreate = () => {
    setEditing(null); setCode(""); setName(""); setEntitlement("0"); setIsPaid(true); setRequiresApproval(true); setOpen(true);
  };
  const openEdit = (t: LeaveType) => {
    setEditing(t); setCode(t.code); setName(t.name); setEntitlement(String(t.default_entitlement_days));
    setIsPaid(t.is_paid); setRequiresApproval(t.requires_approval); setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { name, code: code.toUpperCase().replace(/\s+/g, "_"), default_entitlement_days: Number(entitlement), is_paid: isPaid, requires_approval: requiresApproval },
        });
        toast.success("Leave type updated");
      } else {
        await create.mutateAsync({ companyId, code: code.toUpperCase().replace(/\s+/g, "_"), name, isPaid, defaultEntitlementDays: Number(entitlement), requiresApproval });
        toast.success("Leave type added");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save leave type");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("Leave type deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete -- it may still be in use by leave requests");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={openCreate}>+ Add leave type</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit leave type" : "New leave type"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Default entitlement (days/year)</Label><Input type="number" min="0" value={entitlement} onChange={(e) => setEntitlement(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={isPaid} onCheckedChange={setIsPaid} /><Label>Paid</Label></div>
            <div className="flex items-center gap-2"><Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} /><Label>Requires approval</Label></div>
            <DialogFooter><Button type="submit" disabled={create.isPending || update.isPending}>{editing ? "Save changes" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Entitlement/yr</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.default_entitlement_days}</TableCell>
                  <TableCell className="text-muted-foreground">{t.is_paid ? "Yes" : "No"}</TableCell>
                  <TableCell><Switch checked={t.status === "ACTIVE"} onCheckedChange={(v) => update.mutate({ id: t.id, patch: { status: v ? "ACTIVE" : "INACTIVE" } })} /></TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(t)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Deletion fails if any leave request still references it.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WorkSchedulesTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useWorkSchedules(companyId);
  const { createSchedule, updateSchedule, deleteSchedule } = useScheduleHolidayMutations(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkSchedule | null>(null);
  const [name, setName] = useState("");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState("60");
  const [gracePeriod, setGracePeriod] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkSchedule | null>(null);

  const openCreate = () => {
    setEditing(null); setName(""); setWorkingDays([1, 2, 3, 4, 5]); setStartTime("08:00"); setEndTime("17:00");
    setBreakMinutes("60"); setGracePeriod("0"); setIsDefault(false); setOpen(true);
  };
  const openEdit = (s: WorkSchedule) => {
    setEditing(s); setName(s.name); setWorkingDays(s.working_days); setStartTime(s.start_time.slice(0, 5)); setEndTime(s.end_time.slice(0, 5));
    setBreakMinutes(String(s.break_minutes)); setGracePeriod(String(s.grace_period_minutes)); setIsDefault(s.is_default); setOpen(true);
  };

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editing) {
        await updateSchedule.mutateAsync({
          id: editing.id,
          patch: { name, working_days: workingDays, start_time: startTime, end_time: endTime, break_minutes: Number(breakMinutes), grace_period_minutes: Number(gracePeriod), is_default: isDefault },
        });
        toast.success("Work schedule updated");
      } else {
        await createSchedule.mutateAsync({
          companyId, name, workingDays, startTime, endTime, breakMinutes: Number(breakMinutes), gracePeriodMinutes: Number(gracePeriod), isDefault,
        });
        toast.success("Work schedule added");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save work schedule");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSchedule.mutateAsync(deleteTarget.id);
      toast.success("Work schedule deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete work schedule");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={openCreate}>+ Add schedule</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit work schedule" : "New work schedule"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard 9-to-5" /></div>
            <div className="space-y-1.5">
              <Label>Working days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <button
                    type="button" key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${workingDays.includes(d.value) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>End time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Break (minutes)</Label><Input type="number" min="0" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Grace period (minutes)</Label><Input type="number" min="0" value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={isDefault} onCheckedChange={setIsDefault} /><Label>Default schedule for the company</Label></div>
            <DialogFooter><Button type="submit" disabled={createSchedule.isPending || updateSchedule.isPending}>{editing ? "Save changes" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No work schedules configured yet.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Days</TableHead><TableHead>Hours</TableHead><TableHead>Default</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.working_days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(", ")}</TableCell>
                  <TableCell className="text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</TableCell>
                  <TableCell className="text-muted-foreground">{s.is_default ? "Yes" : "—"}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(s)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HolidaysTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useHolidays(companyId);
  const { createHoliday, updateHoliday, setHolidayStatus, deleteHoliday } = useScheduleHolidayMutations(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [name, setName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [type, setType] = useState("NATIONAL");
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  const openCreate = () => { setEditing(null); setName(""); setHolidayDate(""); setType("NATIONAL"); setOpen(true); };
  const openEdit = (h: Holiday) => { setEditing(h); setName(h.name); setHolidayDate(h.holiday_date); setType(h.type); setOpen(true); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editing) {
        await updateHoliday.mutateAsync({ id: editing.id, patch: { name, holiday_date: holidayDate, type: type as Holiday["type"] } });
        toast.success("Holiday updated");
      } else {
        await createHoliday.mutateAsync({ companyId, name, holidayDate, type: type as never });
        toast.success("Holiday added");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save holiday");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteHoliday.mutateAsync(deleteTarget.id);
      toast.success("Holiday deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete holiday");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={openCreate}>+ Add holiday</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit holiday" : "New holiday"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["NATIONAL", "COMPANY", "SPECIAL"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={createHoliday.isPending || updateHoliday.isPending}>{editing ? "Save changes" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="text-muted-foreground">{h.holiday_date}</TableCell>
                  <TableCell className="text-muted-foreground">{h.type}</TableCell>
                  <TableCell>
                    <Switch checked={h.status === "ACTIVE"} onCheckedChange={(v) => setHolidayStatus.mutate({ id: h.id, status: v ? "ACTIVE" : "CANCELLED" })} />
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(h)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(h)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type TaskTemplate = OnboardingTaskTemplate | OffboardingTaskTemplate;
type TemplateMutations = ReturnType<typeof useTaskTemplateMutations>;

// Shared by both the Onboarding and Offboarding tabs -- same shape,
// different department set and backing table.
function TaskTemplatesTab<D extends string>({ departments, companyId, list, create, update, remove }: {
  departments: readonly D[];
  companyId: string | undefined;
  list: { data: TaskTemplate[] | undefined; isLoading: boolean };
  create: TemplateMutations["createOnboarding"] | TemplateMutations["createOffboarding"];
  update: TemplateMutations["updateOnboarding"] | TemplateMutations["updateOffboarding"];
  remove: TemplateMutations["deleteOnboarding"] | TemplateMutations["deleteOffboarding"];
}) {
  const { data, isLoading } = list;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [department, setDepartment] = useState<D>(departments[0]);
  const [taskType, setTaskType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TaskTemplate | null>(null);

  const openCreate = () => { setEditing(null); setDepartment(departments[0]); setTaskType(""); setTitle(""); setDescription(""); setOpen(true); };
  const openEdit = (t: TaskTemplate) => {
    setEditing(t); setDepartment(t.department as D); setTaskType(t.task_type); setTitle(t.title); setDescription(t.description ?? ""); setOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { department: department as never, task_type: taskType.toUpperCase().replace(/\s+/g, "_") || "CUSTOM", title, description: description || null },
        });
        toast.success("Checklist item updated");
      } else {
        await create.mutateAsync({
          companyId, department: department as never, taskType: taskType.toUpperCase().replace(/\s+/g, "_") || "CUSTOM",
          title, description: description || null, sortOrder: (data?.length ?? 0) + 1,
        });
        toast.success("Task added to the checklist");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success("Checklist item deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete checklist item");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={openCreate}>+ Add checklist item</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit checklist item" : "New checklist item"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Owning department</Label>
              <Select value={department} onValueChange={(v) => setDepartment(v as D)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Title</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Provision Slack access" /></div>
            <div className="space-y-1.5"><Label>Task code (optional)</Label><Input value={taskType} onChange={(e) => setTaskType(e.target.value)} placeholder="e.g. SLACK_ACCESS" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={create.isPending || update.isPending}>{editing ? "Save changes" : "Add"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No checklist items yet -- every new employee's checklist will be empty until you add some.</p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Department</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell className="text-muted-foreground">{t.department}</TableCell>
                  <TableCell>
                    <Switch checked={t.status === "ACTIVE"} onCheckedChange={(v) => update.mutate({ id: t.id, patch: { status: v ? "ACTIVE" : "INACTIVE" } as never })} />
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(t)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
