import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Wrench, CalendarClock } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useCompanyMembers } from "@/features/it/tickets/hooks";
import {
  useAdminAssets, useRooms, useLocations, useMaintenanceRecords, useMaintenanceMutations,
  useMaintenanceSchedules, useMaintenanceScheduleMutations,
} from "@/features/admin/hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminStatusBadge, AdminPriorityBadge } from "@/components/shared/AdminBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { MaintenanceRecord } from "@/types/database";

const FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "CUSTOM"];

export default function MaintenancePage() {
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: records, isLoading } = useMaintenanceRecords(company?.id);
  const { data: assets } = useAdminAssets(company?.id);
  const { data: rooms } = useRooms(company?.id);
  const { data: locations } = useLocations(company?.id);
  const { data: members } = useCompanyMembers(company?.id);
  const { create, complete, cancel, assign, start } = useMaintenanceMutations(company?.id);
  const { data: schedules, isLoading: schedulesLoading } = useMaintenanceSchedules(company?.id);
  const scheduleMutations = useMaintenanceScheduleMutations(company?.id);

  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [issue, setIssue] = useState("");
  const [priority, setPriority] = useState("MEDIUM");

  const [assignTarget, setAssignTarget] = useState<MaintenanceRecord | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schTitle, setSchTitle] = useState("");
  const [schAssetId, setSchAssetId] = useState("");
  const [schRoomId, setSchRoomId] = useState("");
  const [schLocationId, setSchLocationId] = useState("");
  const [schFrequency, setSchFrequency] = useState("MONTHLY");
  const [schIntervalDays, setSchIntervalDays] = useState("");
  const [schNextDate, setSchNextDate] = useState("");

  const assetMap = new Map((assets ?? []).map((a) => [a.id, a.name]));
  const roomMap = new Map((rooms ?? []).map((r) => [r.id, r.name]));
  const locationMap = new Map((locations ?? []).map((l) => [l.id, l.name]));

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ companyId: company!.id, assetId: assetId || null, roomId: !assetId ? roomId || null : null, issue, priority });
      toast.success("Maintenance reported");
      setOpen(false); setAssetId(""); setRoomId(""); setIssue(""); setPriority("MEDIUM");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report issue");
    }
  };

  const handleComplete = async (r: MaintenanceRecord) => {
    try {
      await complete.mutateAsync({ id: r.id });
      toast.success("Marked complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete");
    }
  };

  const openAssign = (r: MaintenanceRecord) => {
    setAssignTarget(r);
    setAssignTo(r.assigned_to ?? "");
    setScheduledDate("");
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignTo) return;
    try {
      await assign.mutateAsync({ id: assignTarget.id, assignedTo: assignTo, scheduledDate: scheduledDate || undefined });
      toast.success("Maintenance assigned");
      setAssignTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    }
  };

  const handleStart = async (r: MaintenanceRecord) => {
    try {
      await start.mutateAsync(r.id);
      toast.success("Marked in progress");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start");
    }
  };

  const handleCreateSchedule = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await scheduleMutations.create.mutateAsync({
        companyId: company!.id, title: schTitle,
        assetId: schAssetId || null, roomId: !schAssetId ? schRoomId || null : null,
        locationId: !schAssetId && !schRoomId ? schLocationId || null : null,
        frequency: schFrequency, intervalDays: schFrequency === "CUSTOM" ? Number(schIntervalDays) : null,
        nextMaintenanceDate: schNextDate,
      });
      toast.success("Schedule created");
      setScheduleOpen(false); setSchTitle(""); setSchAssetId(""); setSchRoomId(""); setSchLocationId("");
      setSchFrequency("MONTHLY"); setSchIntervalDays(""); setSchNextDate("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create schedule");
    }
  };

  const handleToggleSchedule = async (id: string, isActive: boolean) => {
    try {
      await scheduleMutations.update.mutateAsync({ id, patch: { isActive } });
      toast.success(isActive ? "Schedule activated" : "Schedule paused");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update schedule");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Maintenance</h1>
        <p className="text-sm text-muted-foreground">Repairs and upkeep for Admin-owned assets and facilities</p>
      </div>

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4 pt-4">
      <div className="flex justify-end">
        <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_CREATE}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button>+ Report issue</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Report a maintenance issue</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Asset (optional)</Label>
                  <Select value={assetId} onValueChange={setAssetId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{(assets ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!assetId && (
                  <div className="space-y-1.5">
                    <Label>Room (optional)</Label>
                    <Select value={roomId} onValueChange={setRoomId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(rooms ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5"><Label>Issue</Label><Textarea required rows={3} value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Report issue</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </Can>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !records || records.length === 0 ? (
          <EmptyState icon={Wrench} title="No maintenance records" description="Report an issue to get started." />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Item</TableHead><TableHead>Issue</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.maintenance_number}</TableCell>
                  <TableCell className="text-muted-foreground">{r.asset_id ? assetMap.get(r.asset_id) : r.room_id ? roomMap.get(r.room_id) : "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.issue}</TableCell>
                  <TableCell><AdminPriorityBadge priority={r.priority} /></TableCell>
                  <TableCell><AdminStatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_ASSIGN}>
                        {["REPORTED", "ASSESSED"].includes(r.status) && (
                          <Button variant="ghost" size="sm" onClick={() => openAssign(r)}>Assign</Button>
                        )}
                      </Can>
                      {["SCHEDULED", "WAITING_PARTS"].includes(r.status) && (r.assigned_to === user?.id ? (
                        <Button variant="ghost" size="sm" onClick={() => handleStart(r)}>Start</Button>
                      ) : (
                        <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_ASSIGN}>
                          <Button variant="ghost" size="sm" onClick={() => handleStart(r)}>Start</Button>
                        </Can>
                      ))}
                      <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_COMPLETE}>
                        {!["COMPLETED", "CANCELLED"].includes(r.status) && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleComplete(r)}>Complete</Button>
                            <Button variant="ghost" size="sm" onClick={() => cancel.mutate({ id: r.id })}>Cancel</Button>
                          </>
                        )}
                      </Can>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {assignTarget?.maintenance_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Technician</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger><SelectValue placeholder="Select a technician" /></SelectTrigger>
                <SelectContent>{(members ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Scheduled date (optional)</Label><Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={handleAssign} disabled={assign.isPending || !assignTo}>{assign.isPending ? "Saving…" : "Assign"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_CREATE}>
              <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
                <DialogTrigger asChild><Button>+ Schedule</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New maintenance schedule</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreateSchedule} className="space-y-3">
                    <div className="space-y-1.5"><Label>Title</Label><Input required value={schTitle} onChange={(e) => setSchTitle(e.target.value)} /></div>
                    <div className="space-y-1.5">
                      <Label>Asset (optional)</Label>
                      <Select value={schAssetId} onValueChange={setSchAssetId}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>{(assets ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {!schAssetId && (
                      <div className="space-y-1.5">
                        <Label>Room (optional)</Label>
                        <Select value={schRoomId} onValueChange={setSchRoomId}>
                          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>{(rooms ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    {!schAssetId && !schRoomId && (
                      <div className="space-y-1.5">
                        <Label>Location (optional)</Label>
                        <Select value={schLocationId} onValueChange={setSchLocationId}>
                          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                          <SelectContent>{(locations ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">One of Asset, Room, or Location is required.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Frequency</Label>
                        <Select value={schFrequency} onValueChange={setSchFrequency}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      {schFrequency === "CUSTOM" && (
                        <div className="space-y-1.5"><Label>Interval (days)</Label><Input type="number" required value={schIntervalDays} onChange={(e) => setSchIntervalDays(e.target.value)} /></div>
                      )}
                    </div>
                    <div className="space-y-1.5"><Label>Next maintenance date</Label><Input type="date" required value={schNextDate} onChange={(e) => setSchNextDate(e.target.value)} /></div>
                    <DialogFooter>
                      <Button type="submit" disabled={scheduleMutations.create.isPending || (!schAssetId && !schRoomId && !schLocationId)}>
                        {scheduleMutations.create.isPending ? "Saving…" : "Create schedule"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>

          <div className="rounded-lg border border-border bg-card">
            {schedulesLoading ? (
              <div className="space-y-3 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !schedules || schedules.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No maintenance schedules" description="Set up a recurring schedule to get ahead of reactive repairs." />
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Item</TableHead><TableHead>Frequency</TableHead><TableHead>Next due</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.asset_id ? assetMap.get(s.asset_id) : s.room_id ? roomMap.get(s.room_id) : s.location_id ? locationMap.get(s.location_id) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{s.frequency.replace(/_/g, " ")}{s.frequency === "CUSTOM" ? ` (${s.interval_days}d)` : ""}</TableCell>
                      <TableCell className="text-muted-foreground">{s.next_maintenance_date}</TableCell>
                      <TableCell>
                        <Can permission={PERMISSIONS.ADMIN_MAINTENANCE_CREATE}>
                          <Switch checked={s.is_active} onCheckedChange={(checked) => handleToggleSchedule(s.id, checked)} />
                        </Can>
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
