import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useEmploymentTypes, useEmploymentStatuses, useEmploymentConfigMutations,
  useLeaveTypes, useLeaveTypeMutations, useHolidays, useScheduleHolidayMutations,
} from "@/features/hr/hooks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function HrSettingsPage() {
  const { company } = useCompany();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">HR Settings</h1>
        <p className="text-sm text-muted-foreground">Configure employment types, statuses, leave types, and holidays -- companies are never locked into a hard-coded list.</p>
      </div>

      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Employment Types</TabsTrigger>
          <TabsTrigger value="statuses">Employment Statuses</TabsTrigger>
          <TabsTrigger value="leave">Leave Types</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="pt-4"><EmploymentTypesTab companyId={company?.id} /></TabsContent>
        <TabsContent value="statuses" className="pt-4"><EmploymentStatusesTab companyId={company?.id} /></TabsContent>
        <TabsContent value="leave" className="pt-4"><LeaveTypesTab companyId={company?.id} /></TabsContent>
        <TabsContent value="holidays" className="pt-4"><HolidaysTab companyId={company?.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

function EmploymentTypesTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useEmploymentTypes(companyId);
  const { createType, setTypeStatus } = useEmploymentConfigMutations(companyId);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createType.mutateAsync({ code: code.toUpperCase().replace(/\s+/g, "_"), label });
      toast.success("Employment type added");
      setOpen(false); setCode(""); setLabel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add employment type");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm">+ Add type</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New employment type</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5"><Label>Label</Label><Input required value={label} onChange={(e) => setLabel(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SEASONAL" /></div>
            <DialogFooter><Button type="submit" disabled={createType.isPending}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Code</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{t.code}</TableCell>
                  <TableCell>
                    <Switch checked={t.status === "ACTIVE"} onCheckedChange={(v) => setTypeStatus.mutate({ id: t.id, status: v ? "ACTIVE" : "INACTIVE" })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EmploymentStatusesTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useEmploymentStatuses(companyId);
  const { createStatus, setStatusStatus } = useEmploymentConfigMutations(companyId);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [isActiveEmployment, setIsActiveEmployment] = useState(true);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createStatus.mutateAsync({ code: code.toUpperCase().replace(/\s+/g, "_"), label, isActiveEmployment });
      toast.success("Employment status added");
      setOpen(false); setCode(""); setLabel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add employment status");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm">+ Add status</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New employment status</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5"><Label>Label</Label><Input required value={label} onChange={(e) => setLabel(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={isActiveEmployment} onCheckedChange={setIsActiveEmployment} /><Label>Counts as active employment</Label></div>
            <DialogFooter><Button type="submit" disabled={createStatus.isPending}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Code</TableHead><TableHead>Active employment</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.code}</TableCell>
                  <TableCell className="text-muted-foreground">{s.is_active_employment ? "Yes" : "No"}</TableCell>
                  <TableCell><Switch checked={s.status === "ACTIVE"} onCheckedChange={(v) => setStatusStatus.mutate({ id: s.id, status: v ? "ACTIVE" : "INACTIVE" })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LeaveTypesTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useLeaveTypes(companyId);
  const { create, update } = useLeaveTypeMutations(companyId);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [entitlement, setEntitlement] = useState("0");
  const [isPaid, setIsPaid] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(true);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await create.mutateAsync({ companyId, code: code.toUpperCase().replace(/\s+/g, "_"), name, isPaid, defaultEntitlementDays: Number(entitlement), requiresApproval });
      toast.success("Leave type added");
      setOpen(false); setCode(""); setName(""); setEntitlement("0");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add leave type");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm">+ Add leave type</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New leave type</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Code</Label><Input required value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Default entitlement (days/year)</Label><Input type="number" min="0" value={entitlement} onChange={(e) => setEntitlement(e.target.value)} /></div>
            <div className="flex items-center gap-2"><Switch checked={isPaid} onCheckedChange={setIsPaid} /><Label>Paid</Label></div>
            <div className="flex items-center gap-2"><Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} /><Label>Requires approval</Label></div>
            <DialogFooter><Button type="submit" disabled={create.isPending}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Entitlement/yr</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.default_entitlement_days}</TableCell>
                  <TableCell className="text-muted-foreground">{t.is_paid ? "Yes" : "No"}</TableCell>
                  <TableCell><Switch checked={t.status === "ACTIVE"} onCheckedChange={(v) => update.mutate({ id: t.id, patch: { status: v ? "ACTIVE" : "INACTIVE" } })} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function HolidaysTab({ companyId }: { companyId: string | undefined }) {
  const { data, isLoading } = useHolidays(companyId);
  const { createHoliday, setHolidayStatus } = useScheduleHolidayMutations(companyId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [type, setType] = useState("NATIONAL");

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createHoliday.mutateAsync({ companyId, name, holidayDate, type: type as never });
      toast.success("Holiday added");
      setOpen(false); setName(""); setHolidayDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add holiday");
    }
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm">+ Add holiday</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New holiday</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" required value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["NATIONAL", "COMPANY", "SPECIAL"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button type="submit" disabled={createHoliday.isPending}>Add</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  <TableCell className="text-muted-foreground">{h.holiday_date}</TableCell>
                  <TableCell className="text-muted-foreground">{h.type}</TableCell>
                  <TableCell>
                    <Switch checked={h.status === "ACTIVE"} onCheckedChange={(v) => setHolidayStatus.mutate({ id: h.id, status: v ? "ACTIVE" : "CANCELLED" })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
