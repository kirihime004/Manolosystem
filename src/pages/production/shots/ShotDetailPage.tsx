import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useCompany } from "@/lib/tenant/useCompany";
import { useAuth } from "@/lib/auth/useAuth";
import { useMyEmployeeRecord, useEmployees } from "@/features/hr/hooks";
import {
  useProject, useShot, useShotFullCode, useShotMutations, useTasks, useTaskMutations, useTaskTypes,
  useVersions, useVersionMutations, useReviews, useReviewMutations, useNotes, useNoteMutations,
} from "@/features/production/hooks";
import { FrameReviewPlayer } from "@/components/production/FrameReviewPlayer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { ProductionStatusBadge, ProductionRiskBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { AnnotationStroke } from "@/types/database";

const TASK_STATUSES = ["NOT_STARTED", "READY", "IN_PROGRESS", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "COMPLETED", "ON_HOLD"];

export default function ShotDetailPage() {
  const { shotId } = useParams<{ shotId: string }>();
  const { company, hasPermission } = useCompany();
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const { data: employees } = useEmployees(company?.id);
  const { data: shot, isLoading } = useShot(shotId);
  const { data: fullCode } = useShotFullCode(shotId);
  const { update: updateShot } = useShotMutations(shot?.project_id);
  const { data: project } = useProject(shot?.project_id);

  const { data: taskTypes } = useTaskTypes(company?.id);
  const { data: tasks } = useTasks(company?.id, { shotId });
  const taskMutations = useTaskMutations(company?.id);

  const { data: versions } = useVersions({ shotId });
  const versionMutations = useVersionMutations(shotId);

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
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionDescription, setVersionDescription] = useState("");
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [reviewerId, setReviewerId] = useState("");
  const [noteContent, setNoteContent] = useState("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!shot) return <ErrorScreen title="Shot not found" description="This shot does not exist or you do not have access." />;

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await taskMutations.create.mutateAsync({ companyId: company!.id, projectId: shot.project_id, shotId: shot.id, taskTypeId: taskTypeId || null, name: taskName, assignedTo: taskAssignee || null });
      toast.success("Task created");
      setTaskOpen(false); setTaskName(""); setTaskTypeId(""); setTaskAssignee("");
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

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{fullCode ?? shot.shot_code}</p>
          <h1 className="text-xl font-semibold text-foreground">{shot.description ?? shot.shot_code}</h1>
          <p className="text-sm text-muted-foreground">Frames {shot.frame_start}{shot.frame_end ? `–${shot.frame_end}` : ""}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ProductionStatusBadge status={shot.status} />
          <ProductionRiskBadge risk={shot.risk_status} />
        </div>
      </div>

      <Can permission={PERMISSIONS.PRODUCTION_CLIENT_ACCESS_MANAGE}>
        <div className="flex items-center gap-3">
          <Switch checked={shot.client_visible} onCheckedChange={(checked) => updateShot.mutate({ id: shot.id, patch: { clientVisible: checked } })} />
          <p className="text-sm text-muted-foreground">Visible to client portal</p>
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
                  <DialogFooter><Button type="submit" disabled={taskMutations.create.isPending}>Create</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </Can>
        </div>
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead><TableHead>Risk</TableHead></TableRow></TableHeader>
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
                  <TableCell><ProductionRiskBadge risk={t.risk_status} /></TableCell>
                </TableRow>
              ))}
              {(!tasks || tasks.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No tasks yet.</TableCell></TableRow>
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
                <button className="flex w-full items-center justify-between text-left" onClick={() => setExpandedVersionId(expandedVersionId === v.id ? null : v.id)}>
                  <span className="text-sm font-medium text-foreground">v{v.version_number} {v.name ? `— ${v.name}` : ""}</span>
                  <ProductionStatusBadge status={v.status} />
                </button>
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
                    {(reviews ?? []).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{r.reviewer_type === "EMPLOYEE" ? employeeMap.get(r.reviewer_employee_id ?? "") ?? "—" : r.reviewer_name ?? "Client"}</span>
                        <div className="flex items-center gap-2">
                          <ProductionStatusBadge status={r.decision} />
                          {r.decision === "PENDING" && (r.reviewer_employee_id === myEmployee?.id) && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => reviewMutations.decide.mutate({ id: r.id, decision: "APPROVED" })}>Approve</Button>
                              <Button size="sm" variant="ghost" onClick={() => reviewMutations.decide.mutate({ id: r.id, decision: "CHANGES_REQUESTED" })}>Request changes</Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
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
    </div>
  );
}
