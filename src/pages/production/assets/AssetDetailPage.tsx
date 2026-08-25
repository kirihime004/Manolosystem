import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import { useAsset, useAssetMutations, useTasks, useTaskMutations, useTaskTypes, useVersions, useVersionMutations } from "@/features/production/hooks";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";

const TASK_STATUSES = ["NOT_STARTED", "READY", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD"];

export default function AssetDetailPage() {
  const { assetId } = useParams<{ assetId: string }>();
  const { company } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: employees } = useEmployees(company?.id);
  const { data: asset, isLoading } = useAsset(assetId);
  const { update } = useAssetMutations(asset?.project_id);

  const { data: taskTypes } = useTaskTypes(company?.id);
  const { data: tasks } = useTasks(company?.id, { assetId });
  const taskMutations = useTaskMutations(company?.id);

  const { data: versions } = useVersions({ assetId });
  const versionMutations = useVersionMutations(assetId);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionNotes, setVersionNotes] = useState("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!asset) return <ErrorScreen title="Asset not found" description="This asset does not exist or you do not have access." />;

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await taskMutations.create.mutateAsync({ companyId: company!.id, projectId: asset.project_id, assetId: asset.id, taskTypeId: taskTypeId || null, name: taskName });
      toast.success("Task created");
      setTaskOpen(false); setTaskName(""); setTaskTypeId("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create task"); }
  };

  const handleCreateVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) { toast.error("No employee record linked to your account"); return; }
    try {
      await versionMutations.create.mutateAsync({ companyId: company!.id, projectId: asset.project_id, assetId: asset.id, name: versionName || null, notes: versionNotes || null, submittedBy: myEmployee.id });
      toast.success("Version submitted");
      setVersionOpen(false); setVersionName(""); setVersionNotes("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to submit version"); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{asset.asset_code}</p>
          <h1 className="text-xl font-semibold text-foreground">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.asset_category}</p>
        </div>
        <ProductionStatusBadge status={asset.status} />
      </div>

      {asset.description && <p className="text-sm text-foreground">{asset.description}</p>}

      <Can permission={PERMISSIONS.PRODUCTION_ASSETS_UPDATE}>
        <div className="max-w-xs space-y-1.5">
          <Label>Status</Label>
          <Select value={asset.status} onValueChange={(v) => update.mutate({ id: asset.id, patch: { status: v } })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["NOT_STARTED", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Can>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Tasks</h3>
          <Can permission={PERMISSIONS.PRODUCTION_TASKS_CREATE}>
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild><Button size="sm">+ Task</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-3">
                  <div className="space-y-1.5"><Label>Name</Label><Input required value={taskName} onChange={(e) => setTaskName(e.target.value)} /></div>
                  <div className="space-y-1.5">
                    <Label>Task type</Label>
                    <Select value={taskTypeId} onValueChange={setTaskTypeId}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>{(taskTypes ?? []).filter((t) => t.applies_to !== "SHOT").map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <DialogFooter><Button type="submit" disabled={taskMutations.create.isPending}>Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(tasks ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.assigned_to ? employeeMap.get(t.assigned_to) ?? "—" : "Unassigned"}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.PRODUCTION_TASKS_UPDATE} fallback={<ProductionStatusBadge status={t.status} />}>
                      <Select value={t.status} onValueChange={(v) => taskMutations.updateStatus.mutate({ id: t.id, status: v })}>
                        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {(!tasks || tasks.length === 0) && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No tasks yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Versions</h3>
          <Can permission={PERMISSIONS.PRODUCTION_VERSIONS_CREATE}>
            <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
              <DialogTrigger asChild><Button size="sm">+ Submit version</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Submit version</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateVersion} className="space-y-3">
                  <div className="space-y-1.5"><Label>Name (optional)</Label><Input value={versionName} onChange={(e) => setVersionName(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} /></div>
                  <DialogFooter><Button type="submit" disabled={versionMutations.create.isPending}>Submit</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Notes</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(versions ?? []).map((v) => (
                <TableRow key={v.id}>
                  <TableCell>v{v.version_number} {v.name ? `— ${v.name}` : ""}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{v.notes ?? "—"}</TableCell>
                  <TableCell><ProductionStatusBadge status={v.status} /></TableCell>
                </TableRow>
              ))}
              {(!versions || versions.length === 0) && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No versions yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
