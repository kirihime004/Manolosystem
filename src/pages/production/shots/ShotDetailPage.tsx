import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import {
  useProject, useShot, useShotFullCode, useShotMutations, useTasks, useTaskMutations, useTaskTypes,
  useVersions, useVersionMutations, useReviews, useReviewMutations, useNotes, useNoteMutations,
  useProjectTaskStatusOptions, useProductionUnits,
} from "@/features/production/hooks";
import { FrameReviewPlayer } from "@/components/production/FrameReviewPlayer";
import { CustomFieldsSection } from "@/components/production/CustomFieldsSection";
import { TaskPricingPanel } from "@/components/production/TaskPricingPanel";
import { TaskDependenciesPanel } from "@/components/production/TaskDependenciesPanel";
import { ProductionFilesSection } from "@/components/production/ProductionFilesSection";
import { Money } from "@/components/shared/Money";
import { setTaskPricingConfig, recalculateTaskPricing } from "@/features/production/productionRateCardsApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { ProductionStatusBadge, ProductionRiskBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { AnnotationStroke, ProductionTask, ProductionVersion } from "@/types/database";

const TASK_STATUSES = ["NOT_STARTED", "READY", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD"];
const DEFAULT_TASK_STATUS_OPTIONS = TASK_STATUSES.map((s) => ({ status: s, label: s.replace(/_/g, " ") }));

const SHOT_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD", "OMITTED"];

export default function ShotDetailPage() {
  const { shotId } = useParams<{ shotId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { company, hasPermission } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: employees } = useEmployees(company?.id);
  const { data: shot, isLoading } = useShot(shotId);
  const { data: fullCode } = useShotFullCode(shotId);
  const { update: updateShot, remove: removeShot } = useShotMutations(shot?.project_id);
  const { data: project } = useProject(shot?.project_id);

  const { data: taskTypes } = useTaskTypes(company?.id);
  const { data: tasks } = useTasks(company?.id, { shotId });
  const taskMutations = useTaskMutations(company?.id);
  const { data: productionUnits } = useProductionUnits(company?.id);

  const { data: versions } = useVersions({ shotId });
  const versionMutations = useVersionMutations(shotId);

  const [editShotOpen, setEditShotOpen] = useState(false);
  const [shotDescription, setShotDescription] = useState("");
  const [shotFrameEnd, setShotFrameEnd] = useState("");
  const [deleteShotOpen, setDeleteShotOpen] = useState(false);

  const [editingTask, setEditingTask] = useState<ProductionTask | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<ProductionTask | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editTaskAssignee, setEditTaskAssignee] = useState("");
  const [editTaskStartDate, setEditTaskStartDate] = useState("");
  const [editTaskDueDate, setEditTaskDueDate] = useState("");
  const [editTaskEstimatedHours, setEditTaskEstimatedHours] = useState("");
  const [editTaskActualHours, setEditTaskActualHours] = useState("");

  const [deleteVersionTarget, setDeleteVersionTarget] = useState<ProductionVersion | null>(null);

  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const { data: reviews } = useReviews(expandedVersionId ?? undefined);
  const reviewMutations = useReviewMutations(expandedVersionId ?? undefined);

  const { data: notes } = useNotes("SHOT", shotId);
  const noteMutations = useNoteMutations("SHOT", shotId);

  const { data: versionNotes } = useNotes("VERSION", expandedVersionId ?? undefined);
  const versionNoteMutations = useNoteMutations("VERSION", expandedVersionId ?? undefined);

  const [taskOpen, setTaskOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskTypeId, setTaskTypeId] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskUnitId, setTaskUnitId] = useState("");
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [reviewerId, setReviewerId] = useState("");
  const [noteContent, setNoteContent] = useState("");

  const taskStatusOptions = useProjectTaskStatusOptions(project, DEFAULT_TASK_STATUS_OPTIONS);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!shot) return <ErrorScreen title="Shot not found" description="This shot does not exist or you do not have access." />;

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const created = await taskMutations.create.mutateAsync({ companyId: company!.id, projectId: shot.project_id, shotId: shot.id, taskTypeId: taskTypeId || null, name: taskName, assignedTo: taskAssignee || null });
      // A task only gets a price once it has both a task type and a unit --
      // if the person creating it set a unit too, calculate immediately so
      // the price shows without a second trip into the Edit dialog.
      if (taskUnitId && taskTypeId) {
        try {
          await setTaskPricingConfig(created.id, { productionUnitId: taskUnitId });
          await recalculateTaskPricing(created.id);
          queryClient.invalidateQueries({ queryKey: ["production-tasks", company!.id] });
        } catch (pricingErr) {
          toast.error(pricingErr instanceof Error ? pricingErr.message : "Task created, but pricing couldn't be calculated — is a rate card configured?");
        }
      }
      toast.success("Task created");
      setTaskOpen(false); setTaskName(""); setTaskTypeId(""); setTaskAssignee(""); setTaskUnitId("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create task"); }
  };

  const handleCreateVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!myEmployee) { toast.error("No employee record linked to your account"); return; }
    try {
      await versionMutations.create.mutateAsync({
        companyId: company!.id, projectId: shot.project_id, shotId: shot.id, name: versionName || null,
        notes: versionDescription || null, submittedBy: myEmployee.id, file: versionFile,
      });
      toast.success("Version submitted");
      setVersionOpen(false); setVersionName(""); setVersionDescription(""); setVersionFile(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to submit version"); }
  };

  const handleCreateFrameNote = async (input: { content: string; frameNumber: number; annotationData: AnnotationStroke[] | null; annotationWidth: number | null; annotationHeight: number | null }) => {
    if (!user || !expandedVersionId) return;
    await versionNoteMutations.create.mutateAsync({
      companyId: company!.id, resourceType: "VERSION", resourceId: expandedVersionId, authorId: user.id,
      content: input.content, frameNumber: input.frameNumber,
      annotationData: input.annotationData, annotationWidth: input.annotationWidth, annotationHeight: input.annotationHeight,
    });
  };

  const handleRequestReview = async () => {
    if (!expandedVersionId || !reviewerId || !myEmployee) return;
    try {
      await reviewMutations.request.mutateAsync({ companyId: company!.id, versionId: expandedVersionId, reviewerEmployeeId: reviewerId, requestedBy: myEmployee.id });
      toast.success("Review requested");
      setReviewerId("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to request review"); }
  };

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !user) return;
    try {
      await noteMutations.create.mutateAsync({ companyId: company!.id, resourceType: "SHOT", resourceId: shot.id, authorId: user.id, content: noteContent });
      setNoteContent("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add note"); }
  };

  const openEditShot = () => {
    setShotDescription(shot.description ?? "");
    setShotFrameEnd(shot.frame_end != null ? String(shot.frame_end) : "");
    setEditShotOpen(true);
  };
  const handleSaveShot = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await updateShot.mutateAsync({ id: shot.id, patch: { description: shotDescription || null, frameEnd: shotFrameEnd ? Number(shotFrameEnd) : null } });
      toast.success("Shot updated");
      setEditShotOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update shot"); }
  };
  const handleDeleteShot = async () => {
    try {
      await removeShot.mutateAsync(shot.id);
      toast.success("Shot deleted");
      navigate("..");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete shot"); }
  };

  const openEditTask = (t: ProductionTask) => {
    setEditingTask(t);
    setEditTaskName(t.name);
    setEditTaskAssignee(t.assigned_to ?? "");
    setEditTaskStartDate(t.start_date ?? "");
    setEditTaskDueDate(t.due_date ?? "");
    setEditTaskEstimatedHours(t.estimated_hours != null ? String(t.estimated_hours) : "");
    setEditTaskActualHours(t.actual_hours != null ? String(t.actual_hours) : "");
  };
  const handleSaveTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    try {
      await taskMutations.update.mutateAsync({
        id: editingTask.id,
        patch: {
          name: editTaskName, assignedTo: editTaskAssignee || null,
          startDate: editTaskStartDate || null, dueDate: editTaskDueDate || null,
          estimatedHours: editTaskEstimatedHours ? Number(editTaskEstimatedHours) : null,
          actualHours: editTaskActualHours ? Number(editTaskActualHours) : null,
        },
      });
      // Who a task is assigned to can change which rate applies (rates can
      // be scoped to a specific employee) -- refresh the price so it never
      // shows a stale amount from before the reassignment.
      if (editingTask.task_type_id && editingTask.production_unit_id) {
        try {
          await recalculateTaskPricing(editingTask.id);
          queryClient.invalidateQueries({ queryKey: ["production-tasks", company!.id] });
        } catch {
          // Non-fatal -- the assignment itself already saved successfully.
        }
      }
      toast.success("Task updated");
      setEditingTask(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update task"); }
  };
  const handleDeleteTask = async () => {
    if (!deleteTaskTarget) return;
    try {
      await taskMutations.remove.mutateAsync(deleteTaskTarget.id);
      toast.success("Task deleted");
      setDeleteTaskTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete task"); }
  };

  const handleDeleteVersion = async () => {
    if (!deleteVersionTarget) return;
    try {
      await versionMutations.remove.mutateAsync(deleteVersionTarget.id);
      toast.success("Version deleted");
      setDeleteVersionTarget(null);
      if (expandedVersionId === deleteVersionTarget.id) setExpandedVersionId(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete version"); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{fullCode ?? shot.shot_code}</p>
          <h1 className="text-xl font-semibold text-foreground">{shot.description ?? shot.shot_code}</h1>
          <p className="text-sm text-muted-foreground">Frames {shot.frame_start}{shot.frame_end ? `–${shot.frame_end}` : ""}</p>
        </div>
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-end gap-1.5">
            <Can permission={PERMISSIONS.PRODUCTION_SHOTS_UPDATE} fallback={<ProductionStatusBadge status={shot.status} />}>
              <Select
                value={shot.status}
                onValueChange={(v) => updateShot.mutate(
                  { id: shot.id, patch: { status: v } },
                  { onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update shot status") },
                )}
              >
                <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHOT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </Can>
            <ProductionRiskBadge risk={shot.risk_status} />
          </div>
          <Can permission={PERMISSIONS.PRODUCTION_SHOTS_UPDATE}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openEditShot}>Edit</DropdownMenuItem>
                <Can permission={PERMISSIONS.PRODUCTION_SHOTS_DELETE}>
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteShotOpen(true)}>Delete</DropdownMenuItem>
                </Can>
              </DropdownMenuContent>
            </DropdownMenu>
          </Can>
        </div>
      </div>

      <Can permission={PERMISSIONS.PRODUCTION_CLIENT_ACCESS_MANAGE}>
        <div className="flex items-center gap-3">
          <Switch checked={shot.client_visible} onCheckedChange={(checked) => updateShot.mutate({ id: shot.id, patch: { clientVisible: checked } })} />
          <p className="text-sm text-muted-foreground">Visible to client portal</p>
        </div>
      </Can>

      <CustomFieldsSection companyId={company?.id} entityType="SHOT" entityId={shot.id} projectId={shot.project_id} />

      <ProductionFilesSection resourceType="SHOT" resourceId={shot.id} />

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
                      <SelectContent>{(taskTypes ?? []).filter((t) => t.applies_to !== "ASSET").map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assignee</Label>
                    <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Pricing unit <span className="text-muted-foreground">(optional — set this to price the task now)</span></Label>
                    <Select value={taskUnitId} onValueChange={setTaskUnitId}>
                      <SelectTrigger><SelectValue placeholder="No unit — price later" /></SelectTrigger>
                      <SelectContent>{(productionUnits ?? []).filter((u) => u.is_active).map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
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
            <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead><TableHead>Price</TableHead><TableHead>Risk</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {(tasks ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.assigned_to ? employeeMap.get(t.assigned_to) ?? "—" : "Unassigned"}</TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.PRODUCTION_TASKS_UPDATE} fallback={<ProductionStatusBadge status={t.status} />}>
                      <Select
                        value={t.status}
                        onValueChange={(v) => taskMutations.updateStatus.mutate(
                          { id: t.id, status: v },
                          { onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update status — it may have unfinished dependencies") },
                        )}
                      >
                        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {taskStatusOptions.some((o) => o.status === t.status)
                            ? null
                            : <SelectItem value={t.status}>{t.status.replace(/_/g, " ")}</SelectItem>}
                          {taskStatusOptions.map((o) => <SelectItem key={o.status} value={o.status}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Can>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.calculated_amount != null ? <Money amount={t.calculated_amount} currencyId={t.pricing_currency_id} /> : "—"}
                  </TableCell>
                  <TableCell><ProductionRiskBadge risk={t.risk_status} /></TableCell>
                  <TableCell>
                    <Can permission={PERMISSIONS.PRODUCTION_TASKS_UPDATE}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditTask(t)}>Edit</DropdownMenuItem>
                          <Can permission={PERMISSIONS.PRODUCTION_TASKS_DELETE}>
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTaskTarget(t)}>Delete</DropdownMenuItem>
                          </Can>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {(!tasks || tasks.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No tasks yet.</TableCell></TableRow>
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
                  <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={versionDescription} onChange={(e) => setVersionDescription(e.target.value)} /></div>
                  <div className="space-y-1.5">
                    <Label>Media (video or image, for frame-by-frame review)</Label>
                    <Input type="file" accept="video/*,image/*" onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)} />
                  </div>
                  <DialogFooter><Button type="submit" disabled={versionMutations.create.isPending}>Submit</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
        <div className="space-y-2">
          {(versions ?? []).map((v) => (
            <Card key={v.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex w-full items-center justify-between gap-2">
                  <button className="flex flex-1 items-center justify-between text-left" onClick={() => setExpandedVersionId(expandedVersionId === v.id ? null : v.id)}>
                    <span className="text-sm font-medium text-foreground">v{v.version_number} {v.name ? `— ${v.name}` : ""}</span>
                  </button>
                  <ProductionStatusBadge status={v.status} />
                  <Can permission={PERMISSIONS.PRODUCTION_VERSIONS_DELETE}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDeleteVersionTarget(v)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </Can>
                </div>
                {v.notes && <p className="text-xs text-muted-foreground">{v.notes}</p>}
                {expandedVersionId === v.id && (
                  <div className="space-y-3 border-t border-border pt-3">
                    <FrameReviewPlayer
                      storagePath={v.file_path}
                      fps={project?.fps ?? 24}
                      frameOffset={shot.frame_start}
                      notes={versionNotes ?? []}
                      canAnnotate={hasPermission(PERMISSIONS.PRODUCTION_NOTES_CREATE)}
                      onCreateNote={handleCreateFrameNote}
                    />
                    {(reviews ?? []).map((r) => {
                      const isPickedReviewer = r.reviewer_employee_id === myEmployee?.id;
                      const canDecide = isPickedReviewer || hasPermission(PERMISSIONS.PRODUCTION_REVIEWS_DECIDE);
                      return (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Requested from {r.reviewer_type === "EMPLOYEE" ? employeeMap.get(r.reviewer_employee_id ?? "") ?? "—" : r.reviewer_name ?? "Client"}
                          </span>
                          <div className="flex items-center gap-2">
                            <ProductionStatusBadge status={r.decision} />
                            {r.decision === "PENDING" && canDecide && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => reviewMutations.decide.mutate({ id: r.id, decision: "APPROVED" })}>Approve</Button>
                                <Button size="sm" variant="ghost" onClick={() => reviewMutations.decide.mutate({ id: r.id, decision: "CHANGES_REQUESTED" })}>Request changes</Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <Can permission={PERMISSIONS.PRODUCTION_REVIEWS_CREATE}>
                      <div className="flex gap-2">
                        <Select value={reviewerId} onValueChange={setReviewerId}>
                          <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Request review from…" /></SelectTrigger>
                          <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleRequestReview} disabled={!reviewerId}>Request</Button>
                      </div>
                    </Can>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {(!versions || versions.length === 0) && <p className="text-sm text-muted-foreground">No versions submitted yet.</p>}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Notes</h3>
        <div className="space-y-2">
          {(notes ?? []).map((n) => (
            <div key={n.id} className="rounded-md border border-border p-3 text-sm">
              <p>{n.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()} {n.status === "RESOLVED" ? "· Resolved" : ""}</p>
            </div>
          ))}
          {(!notes || notes.length === 0) && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        </div>
        <form onSubmit={handleAddNote} className="flex gap-2">
          <Textarea rows={2} value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Add a note…" />
          <Button type="submit" disabled={noteMutations.create.isPending}>Post</Button>
        </form>
      </div>

      <Dialog open={editShotOpen} onOpenChange={setEditShotOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit shot</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveShot} className="space-y-3">
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={shotDescription} onChange={(e) => setShotDescription(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Frame end</Label><Input type="number" value={shotFrameEnd} onChange={(e) => setShotFrameEnd(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={updateShot.isPending}>Save changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit task</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTask} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={editTaskAssignee || "__none__"} onValueChange={(v) => setEditTaskAssignee(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Start date</Label><Input type="date" value={editTaskStartDate} onChange={(e) => setEditTaskStartDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={editTaskDueDate} onChange={(e) => setEditTaskDueDate(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Bid (hours)</Label><Input type="number" min="0" step="0.5" value={editTaskEstimatedHours} onChange={(e) => setEditTaskEstimatedHours(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Time logged (hours)</Label><Input type="number" min="0" step="0.5" value={editTaskActualHours} onChange={(e) => setEditTaskActualHours(e.target.value)} /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={taskMutations.update.isPending}>Save changes</Button></DialogFooter>
          </form>
          {editingTask && <CustomFieldsSection companyId={company?.id} entityType="TASK" entityId={editingTask.id} projectId={shot.project_id} />}
          {editingTask && <TaskDependenciesPanel task={editingTask} siblingTasks={tasks ?? []} />}
          {editingTask && <TaskPricingPanel task={editingTask} canSubmitWork={editingTask.assigned_to === myEmployee?.id || hasPermission(PERMISSIONS.PRODUCTION_TASKS_UPDATE)} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteShotOpen} onOpenChange={setDeleteShotOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {shot.shot_code}?</AlertDialogTitle>
            <AlertDialogDescription>Its tasks and versions will also be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShot}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTaskTarget} onOpenChange={(open) => !open && setDeleteTaskTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTaskTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVersionTarget} onOpenChange={(open) => !open && setDeleteVersionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete v{deleteVersionTarget?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>Its reviews will also be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVersion}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
