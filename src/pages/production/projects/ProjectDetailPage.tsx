import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { MoreHorizontal, Clapperboard, ListChecks, CalendarClock, HeartPulse, CalendarDays, Flag, Clock } from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useProject, useProjectMutations, useShows, useEpisodes, useSequences, useHierarchyMutations,
  useProjectMembers, useProjectMemberMutations, useMilestones, useMilestoneMutations,
  useDeliverables, useDeliverableMutations, useProductionBudgetSummary, useWorkflowTemplates,
  useProjectInsights, useProjectDashboard, useTasks, useTaskTypes,
} from "@/features/production/hooks";
import { CustomFieldsSection } from "@/components/production/CustomFieldsSection";
import { ProductionFilesSection } from "@/components/production/ProductionFilesSection";
import { ProductionHistorySection } from "@/components/production/ProductionHistorySection";
import {
  DonutChart, StackedBarChart, HorizontalBarChart, PhaseTimelineChart, GanttChart, statusChartColor,
  bucketTaskStatusCounts, DeltaIndicator, type GanttPhaseRow, type GanttPhaseStatus,
} from "@/components/production/charts/ProductionCharts";
import { useEmployees } from "@/features/hr/hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorScreen } from "@/components/shared/ErrorScreen";
import { ProductionStatusBadge } from "@/components/shared/ProductionBadges";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { ProductionEpisode, ProductionMilestone, ProductionDeliverable, ProductionSequence, ProductionShow, ProductionTask } from "@/types/database";

const EPISODE_STATUSES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "DELIVERED", "ON_HOLD"];
const SEQUENCE_STATUSES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"];

// Delete on shows/episodes/sequences/milestones is gated by
// PRODUCTION.PROJECTS.MANAGE at the database level (RLS), which is a
// distinct, usually-higher-tier permission from each entity's own
// *_UPDATE permission that gates Edit -- so the two need independent
// permission checks here, not one shared wrapper, or a role with update
// but not project-manage would see a Delete option that silently fails
// under RLS when clicked.
function RowActions({ canEdit, canDelete, onEdit, onDelete }: { canEdit: boolean; canDelete: boolean; onEdit?: () => void; onDelete: () => void }) {
  if (!canEdit && !canDelete) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && onEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
        {canDelete && <DropdownMenuItem variant="destructive" onClick={onDelete}>Delete</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { company, hasPermission } = useCompany();
  const { data: project, isLoading } = useProject(projectId);
  const { update, remove: removeProject } = useProjectMutations(company?.id);
  const { data: employees } = useEmployees(company?.id);

  const { data: shows } = useShows(projectId);
  const { data: episodes } = useEpisodes(projectId);
  const { data: sequences } = useSequences(projectId);
  const hierarchy = useHierarchyMutations(projectId);

  const { data: members } = useProjectMembers(projectId);
  const memberMutations = useProjectMemberMutations(projectId);

  const { data: milestones } = useMilestones(projectId);
  const milestoneMutations = useMilestoneMutations(projectId);

  const { data: deliverables } = useDeliverables(projectId);
  const deliverableMutations = useDeliverableMutations(projectId);

  const { data: budgetSummary } = useProductionBudgetSummary(projectId);
  const { data: insights } = useProjectInsights(projectId);
  const canViewDashboard = hasPermission(PERMISSIONS.PRODUCTION_PROJECT_DASHBOARD_VIEW);
  const { data: dash, isLoading: dashLoading } = useProjectDashboard(projectId, canViewDashboard);
  const { data: allTasks } = useTasks(company?.id, { projectId });
  const { data: taskTypes } = useTaskTypes(company?.id);
  const { data: workflowTemplates } = useWorkflowTemplates(company?.id);
  const taskWorkflowTemplates = (workflowTemplates ?? []).filter((w) => w.entity_type === "TASK");

  // Overview: edit + delete project
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectTaskWorkflowId, setProjectTaskWorkflowId] = useState("");
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);

  // Shows
  const [showOpen, setShowOpen] = useState(false);
  const [editingShow, setEditingShow] = useState<ProductionShow | null>(null);
  const [showName, setShowName] = useState("");
  const [showDescription, setShowDescription] = useState("");
  const [deleteShowTarget, setDeleteShowTarget] = useState<ProductionShow | null>(null);

  // Episodes
  const [episodeOpen, setEpisodeOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<ProductionEpisode | null>(null);
  const [episodeNumber, setEpisodeNumber] = useState("1");
  const [episodeName, setEpisodeName] = useState("");
  const [episodeStatus, setEpisodeStatus] = useState("PLANNING");
  const [deleteEpisodeTarget, setDeleteEpisodeTarget] = useState<ProductionEpisode | null>(null);

  // Sequences
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<ProductionSequence | null>(null);
  const [sequenceNumber, setSequenceNumber] = useState("10");
  const [sequenceEpisodeId, setSequenceEpisodeId] = useState("");
  const [sequenceName, setSequenceName] = useState("");
  const [sequenceStatus, setSequenceStatus] = useState("PLANNING");
  const [deleteSequenceTarget, setDeleteSequenceTarget] = useState<ProductionSequence | null>(null);

  const [memberOpen, setMemberOpen] = useState(false);
  const [memberEmployeeId, setMemberEmployeeId] = useState("");
  const [memberRole, setMemberRole] = useState("ARTIST");

  // Milestones
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProductionMilestone | null>(null);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [deleteMilestoneTarget, setDeleteMilestoneTarget] = useState<ProductionMilestone | null>(null);

  // Deliverables
  const [deliverableOpen, setDeliverableOpen] = useState(false);
  const [editingDeliverable, setEditingDeliverable] = useState<ProductionDeliverable | null>(null);
  const [deliverableName, setDeliverableName] = useState("");
  const [deliverableDue, setDeliverableDue] = useState("");
  const [deleteDeliverableTarget, setDeleteDeliverableTarget] = useState<ProductionDeliverable | null>(null);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!project) return <ErrorScreen title="Project not found" description="This project does not exist or you do not have access." />;

  const employeeMap = new Map((employees ?? []).map((e) => [e.id, `${e.first_name} ${e.last_name}`]));

  // ---- Dashboard tab derived values ----
  const dashRangeStart = project.start_date ?? new Date().toISOString().slice(0, 10);
  const dashRangeEnd = project.target_end_date ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const phaseRows = (dash?.phases ?? []).map((p) => ({
    key: p.task_type, label: p.task_type, plannedStart: p.planned_start, plannedEnd: p.planned_end,
    actualStart: p.actual_start, actualEnd: p.actual_end, progressPct: p.progress_pct,
  }));
  const milestoneMarkers = (dash?.milestones ?? []).map((m) => ({ key: m.milestone_code, label: m.name, date: m.due_date, done: m.status === "COMPLETED" }));
  const taskStatusDonutData = bucketTaskStatusCounts(insights?.task_status_counts ?? []);
  const pendingReviewCount = (insights?.task_status_counts ?? []).find((s) => s.status === "PENDING_REVIEW")?.count ?? 0;

  const dashboardInsights: { text: string; tone: "success" | "warn" | "info" }[] = [];
  if (dash) {
    const { header, stats } = dash;
    if (stats.health === "LATE" && header.target_end_date) {
      const overdue = Math.max(0, Math.round((Date.now() - new Date(header.target_end_date).getTime()) / 86400000));
      dashboardInsights.push({ text: overdue > 0 ? `Project is ${overdue} day${overdue === 1 ? "" : "s"} behind schedule.` : "Project has missed its target completion date.", tone: "warn" });
    } else if (stats.health === "AT_RISK" && stats.days_remaining != null) {
      dashboardInsights.push({ text: `Target completion is in ${stats.days_remaining} day${stats.days_remaining === 1 ? "" : "s"} — monitor closely.`, tone: "warn" });
    } else if (stats.health === "ON_TRACK") {
      dashboardInsights.push({ text: "Project is on track.", tone: "success" });
    }
    if (header.overall_completion_pct > 0 && header.overall_completion_pct < 100 && header.target_end_date) {
      const elapsedDays = (Date.now() - new Date(header.start_date).getTime()) / 86400000;
      if (elapsedDays > 0) {
        const projectedTotalDays = elapsedDays / (header.overall_completion_pct / 100);
        const projectedEnd = new Date(new Date(header.start_date).getTime() + projectedTotalDays * 86400000);
        const diffDays = Math.round((projectedEnd.getTime() - new Date(header.target_end_date).getTime()) / 86400000);
        const projectedLabel = projectedEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
        if (diffDays > 0) dashboardInsights.push({ text: `If current pace continues, projected completion is ${projectedLabel} (${diffDays} day${diffDays === 1 ? "" : "s"} late).`, tone: "warn" });
        else if (diffDays < 0) dashboardInsights.push({ text: `If current pace continues, projected completion is ${projectedLabel} (${-diffDays} day${diffDays === -1 ? "" : "s"} early).`, tone: "success" });
      }
    }
    if (pendingReviewCount > 0) dashboardInsights.push({ text: `${pendingReviewCount} task${pendingReviewCount === 1 ? "" : "s"} pending review.`, tone: "info" });
    const lateMilestones = dash.milestones.filter((m) => m.completed_date && m.due_date && m.completed_date > m.due_date).length;
    if (lateMilestones > 0) dashboardInsights.push({ text: `${lateMilestones} milestone${lateMilestones === 1 ? "" : "s"} completed late.`, tone: "warn" });
  }

  // ---- Timeline tab derived values (independent of the Dashboard permission) ----
  const tasksTotal = allTasks?.length ?? 0;
  const tasksDone = (allTasks ?? []).filter((t) => t.status === "COMPLETED" || t.status === "APPROVED").length;
  const overallPct = tasksTotal > 0 ? Math.round((100 * tasksDone) / tasksTotal) : 0;
  const daysRemaining = project.target_end_date ? Math.round((new Date(project.target_end_date).getTime() - Date.now()) / 86400000) : null;
  const projectHealth: GanttPhaseStatus =
    project.status === "COMPLETED" && project.actual_end_date && project.target_end_date && project.actual_end_date > project.target_end_date ? "LATE"
    : project.status === "COMPLETED" || project.status === "CANCELLED" || project.status === "ARCHIVED" ? "COMPLETED"
    : project.target_end_date && project.target_end_date < new Date().toISOString().slice(0, 10) ? "LATE"
    : project.target_end_date && project.target_end_date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) ? "AT_RISK"
    : "ON_TRACK";

  let projectedCompletionLabel: string | null = null;
  let projectedCompletionDiffDays: number | null = null;
  if (project.start_date && project.target_end_date && overallPct > 0 && overallPct < 100) {
    const elapsedDays = (Date.now() - new Date(project.start_date).getTime()) / 86400000;
    if (elapsedDays > 0) {
      const projectedTotalDays = elapsedDays / (overallPct / 100);
      const projectedEnd = new Date(new Date(project.start_date).getTime() + projectedTotalDays * 86400000);
      projectedCompletionDiffDays = Math.round((projectedEnd.getTime() - new Date(project.target_end_date).getTime()) / 86400000);
      projectedCompletionLabel = projectedEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
  }

  const taskTypeMap = new Map((taskTypes ?? []).map((tt) => [tt.id, tt]));
  const tasksByType = new Map<string, ProductionTask[]>();
  for (const t of allTasks ?? []) {
    const key = t.task_type_id ?? "__unassigned__";
    if (!tasksByType.has(key)) tasksByType.set(key, []);
    tasksByType.get(key)!.push(t);
  }
  const ganttPhases: GanttPhaseRow[] = [...tasksByType.entries()]
    .map(([typeId, typeTasks]) => {
      const meta = taskTypeMap.get(typeId);
      const starts = typeTasks.map((t) => t.start_date).filter((d): d is string => !!d);
      const ends = typeTasks.map((t) => t.due_date).filter((d): d is string => !!d);
      const plannedStart = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
      const plannedEnd = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;
      const doneCount = typeTasks.filter((t) => t.status === "COMPLETED" || t.status === "APPROVED").length;
      const progressPct = typeTasks.length ? Math.round((100 * doneCount) / typeTasks.length) : 0;
      const allDone = typeTasks.length > 0 && doneCount === typeTasks.length;
      const actualEnd = allDone ? typeTasks.reduce((latest, t) => (!latest || t.updated_at > latest ? t.updated_at : latest), "").slice(0, 10) : null;
      const anyStarted = typeTasks.some((t) => t.status !== "NOT_STARTED");
      const status: GanttPhaseStatus = allDone ? "COMPLETED"
        : typeTasks.some((t) => t.risk_status === "LATE") ? "LATE"
        : typeTasks.some((t) => t.risk_status === "AT_RISK") ? "AT_RISK"
        : anyStarted ? "ON_TRACK" : "NOT_STARTED";
      return {
        key: typeId, label: meta?.name ?? "Unassigned", sortOrder: meta?.sort_order ?? 999,
        plannedStart, plannedEnd, actualEnd, progressPct, status,
        tasks: typeTasks.map((t) => ({ key: t.id, label: t.name, start: t.start_date, end: t.due_date, status: t.status, assignedToName: t.assigned_to ? employeeMap.get(t.assigned_to) : null })),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const ganttMilestones = (milestones ?? []).map((m) => ({ key: m.id, label: m.name, date: m.due_date }));
  const ganttRangeStart = project.start_date ?? new Date().toISOString().slice(0, 10);
  const ganttRangeEnd = project.target_end_date ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const openEditProject = () => {
    setProjectName(project.name);
    setProjectDescription(project.description ?? "");
    setProjectTaskWorkflowId(project.task_workflow_template_id ?? "");
    setEditProjectOpen(true);
  };
  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await update.mutateAsync({
        id: project.id,
        patch: { name: projectName, description: projectDescription || null, taskWorkflowTemplateId: projectTaskWorkflowId || null },
      });
      toast.success("Project updated");
      setEditProjectOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update project"); }
  };
  const handleDeleteProject = async () => {
    try {
      await removeProject.mutateAsync(project.id);
      toast.success("Project deleted");
      navigate("..");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete project"); }
  };

  const openCreateShow = () => { setEditingShow(null); setShowName(""); setShowDescription(""); setShowOpen(true); };
  const openEditShow = (s: ProductionShow) => { setEditingShow(s); setShowName(s.name); setShowDescription(s.description ?? ""); setShowOpen(true); };
  const handleSaveShow = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingShow) {
        await hierarchy.updateShow.mutateAsync({ id: editingShow.id, patch: { name: showName, description: showDescription || null } });
        toast.success("Show updated");
      } else {
        await hierarchy.createShow.mutateAsync({ companyId: company!.id, projectId: project.id, name: showName, description: showDescription || null });
        toast.success("Show created");
      }
      setShowOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save show"); }
  };
  const handleDeleteShow = async () => {
    if (!deleteShowTarget) return;
    try {
      await hierarchy.deleteShow.mutateAsync(deleteShowTarget.id);
      toast.success("Show deleted");
      setDeleteShowTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete show"); }
  };

  const openCreateEpisode = () => { setEditingEpisode(null); setEpisodeNumber("1"); setEpisodeName(""); setEpisodeStatus("PLANNING"); setEpisodeOpen(true); };
  const openEditEpisode = (ep: ProductionEpisode) => { setEditingEpisode(ep); setEpisodeName(ep.name ?? ""); setEpisodeStatus(ep.status); setEpisodeOpen(true); };
  const handleSaveEpisode = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingEpisode) {
        await hierarchy.updateEpisode.mutateAsync({ id: editingEpisode.id, patch: { name: episodeName || null, status: episodeStatus } });
        toast.success("Episode updated");
      } else {
        await hierarchy.createEpisode.mutateAsync({ companyId: company!.id, projectId: project.id, episodeNumber: Number(episodeNumber) });
        toast.success("Episode created");
      }
      setEpisodeOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save episode"); }
  };
  const handleDeleteEpisode = async () => {
    if (!deleteEpisodeTarget) return;
    try {
      await hierarchy.deleteEpisode.mutateAsync(deleteEpisodeTarget.id);
      toast.success("Episode deleted");
      setDeleteEpisodeTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete episode"); }
  };

  const openCreateSequence = () => { setEditingSequence(null); setSequenceNumber("10"); setSequenceEpisodeId(""); setSequenceName(""); setSequenceStatus("PLANNING"); setSequenceOpen(true); };
  const openEditSequence = (s: ProductionSequence) => { setEditingSequence(s); setSequenceName(s.name ?? ""); setSequenceStatus(s.status); setSequenceOpen(true); };
  const handleSaveSequence = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingSequence) {
        await hierarchy.updateSequence.mutateAsync({ id: editingSequence.id, patch: { name: sequenceName || null, status: sequenceStatus } });
        toast.success("Sequence updated");
      } else {
        await hierarchy.createSequence.mutateAsync({ companyId: company!.id, projectId: project.id, episodeId: sequenceEpisodeId || null, sequenceNumber: Number(sequenceNumber) });
        toast.success("Sequence created");
      }
      setSequenceOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save sequence"); }
  };
  const handleDeleteSequence = async () => {
    if (!deleteSequenceTarget) return;
    try {
      await hierarchy.deleteSequence.mutateAsync(deleteSequenceTarget.id);
      toast.success("Sequence deleted");
      setDeleteSequenceTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete sequence"); }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!memberEmployeeId) return;
    try {
      await memberMutations.add.mutateAsync({ companyId: company!.id, projectId: project.id, employeeId: memberEmployeeId, projectRole: memberRole });
      toast.success("Member added");
      setMemberOpen(false); setMemberEmployeeId("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add member"); }
  };

  const openCreateMilestone = () => { setEditingMilestone(null); setMilestoneName(""); setMilestoneDue(""); setMilestoneOpen(true); };
  const openEditMilestone = (m: ProductionMilestone) => { setEditingMilestone(m); setMilestoneName(m.name); setMilestoneDue(m.due_date); setMilestoneOpen(true); };
  const handleSaveMilestone = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingMilestone) {
        await milestoneMutations.update.mutateAsync({ id: editingMilestone.id, patch: { name: milestoneName, dueDate: milestoneDue } });
        toast.success("Milestone updated");
      } else {
        await milestoneMutations.create.mutateAsync({ companyId: company!.id, projectId: project.id, name: milestoneName, dueDate: milestoneDue });
        toast.success("Milestone created");
      }
      setMilestoneOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save milestone"); }
  };
  const handleDeleteMilestone = async () => {
    if (!deleteMilestoneTarget) return;
    try {
      await milestoneMutations.remove.mutateAsync(deleteMilestoneTarget.id);
      toast.success("Milestone deleted");
      setDeleteMilestoneTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete milestone"); }
  };

  const openCreateDeliverable = () => { setEditingDeliverable(null); setDeliverableName(""); setDeliverableDue(""); setDeliverableOpen(true); };
  const openEditDeliverable = (d: ProductionDeliverable) => { setEditingDeliverable(d); setDeliverableName(d.name); setDeliverableDue(d.due_date ?? ""); setDeliverableOpen(true); };
  const handleSaveDeliverable = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingDeliverable) {
        await deliverableMutations.update.mutateAsync({ id: editingDeliverable.id, patch: { name: deliverableName, dueDate: deliverableDue || null } });
        toast.success("Deliverable updated");
      } else {
        await deliverableMutations.create.mutateAsync({ companyId: company!.id, projectId: project.id, name: deliverableName, dueDate: deliverableDue || null });
        toast.success("Deliverable created");
      }
      setDeliverableOpen(false);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to save deliverable"); }
  };
  const handleDeleteDeliverable = async () => {
    if (!deleteDeliverableTarget) return;
    try {
      await deliverableMutations.remove.mutateAsync(deleteDeliverableTarget.id);
      toast.success("Deliverable deleted");
      setDeleteDeliverableTarget(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete deliverable"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{project.project_code}</p>
          <h1 className="text-xl font-semibold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.project_type.replace(/_/g, " ")}{project.director_id ? ` · Directed by ${employeeMap.get(project.director_id) ?? "—"}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <ProductionStatusBadge status={project.status} />
          <RowActions
            canEdit={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_UPDATE)}
            canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
            onEdit={openEditProject}
            onDelete={() => setDeleteProjectOpen(true)}
          />
        </div>
      </div>

      <Tabs defaultValue={canViewDashboard ? "dashboard" : "overview"}>
        <TabsList>
          {canViewDashboard && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="hierarchy">Episodes & Sequences</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
        </TabsList>

        {canViewDashboard && (
          <TabsContent value="dashboard" className="space-y-4 pt-4">
            {dashLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <>
                <Card>
                  <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
                    <div><p className="text-xs text-muted-foreground">Client</p><p className="text-sm font-medium text-foreground">{dash?.header.client_name ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Producer</p><p className="text-sm font-medium text-foreground">{dash?.header.producer_name ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Director</p><p className="text-sm font-medium text-foreground">{dash?.header.director_name ?? "—"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Start Date</p><p className="text-sm font-medium text-foreground">{dash?.header.start_date}</p></div>
                    <div className="col-span-2 sm:col-span-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Overall Completion</span><span className="tabular-nums">{dash?.header.overall_completion_pct ?? 0}%</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-primary" style={{ width: `${dash?.header.overall_completion_pct ?? 0}%` }} /></div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Shots Completed</CardDescription><Clapperboard className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{dash?.stats.shots_completed ?? 0} / {dash?.stats.shots_total ?? 0}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Tasks Completed</CardDescription><ListChecks className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{dash?.stats.tasks_completed ?? 0} / {dash?.stats.tasks_total ?? 0}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Days Remaining</CardDescription><CalendarClock className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{dash?.stats.days_remaining ?? "—"}</div></CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Project Health</CardDescription><HeartPulse className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent>
                      <div className={`text-lg font-semibold ${dash?.stats.health === "LATE" ? "text-red-600 dark:text-red-400" : dash?.stats.health === "AT_RISK" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {dash?.stats.health === "LATE" ? "Late" : dash?.stats.health === "AT_RISK" ? "At Risk" : "On Track"}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-base">Planned vs Actual Timeline</CardTitle></CardHeader>
                    <CardContent><PhaseTimelineChart phases={phaseRows} milestones={milestoneMarkers} rangeStart={dashRangeStart} rangeEnd={dashRangeEnd} /></CardContent>
                  </Card>
                  <div className="space-y-4">
                    <Card>
                      <CardHeader><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow><TableHead>Milestone</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {(dash?.milestones ?? []).map((m) => {
                              const late = !!(m.completed_date && m.completed_date > m.due_date);
                              const daysLate = late ? Math.round((new Date(m.completed_date!).getTime() - new Date(m.due_date).getTime()) / 86400000) : 0;
                              return (
                                <TableRow key={m.milestone_code}>
                                  <TableCell className="text-sm">{m.name}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{m.due_date}</TableCell>
                                  <TableCell className="text-xs">
                                    {m.completed_date
                                      ? late
                                        ? <span className="text-amber-600 dark:text-amber-400">{daysLate} day{daysLate === 1 ? "" : "s"} late</span>
                                        : <span className="text-emerald-600 dark:text-emerald-400">Completed</span>
                                      : <span className="text-muted-foreground">Pending</span>}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {(!dash?.milestones || dash.milestones.length === 0) && (
                              <TableRow><TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">No milestones yet.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base">Upcoming Deadlines</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Due</TableHead><TableHead>Assigned</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {(dash?.upcoming_deadlines ?? []).map((d) => (
                              <TableRow key={`${d.task_name}-${d.due_date}`}>
                                <TableCell className="text-sm">{d.task_name}</TableCell>
                                <TableCell className={`text-xs ${d.days_left <= 3 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{d.due_date} ({d.days_left}d)</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{d.assigned_to_name ?? "Unassigned"}</TableCell>
                              </TableRow>
                            ))}
                            {(!dash?.upcoming_deadlines || dash.upcoming_deadlines.length === 0) && (
                              <TableRow><TableCell colSpan={3} className="py-6 text-center text-xs text-muted-foreground">Nothing due soon.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Current Focus</CardTitle></CardHeader>
                    <CardContent>
                      {dash?.current_focus ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">{dash.current_focus.task_type}</p>
                          <p className="text-xs text-muted-foreground">{dash.current_focus.range_start ?? "—"} – {dash.current_focus.range_end ?? "—"}</p>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-primary" style={{ width: `${dash.current_focus.progress_pct}%` }} /></div>
                          <p className="text-xs text-muted-foreground">{dash.current_focus.team_count} team member{dash.current_focus.team_count === 1 ? "" : "s"} working on {dash.current_focus.in_progress_count} open task{dash.current_focus.in_progress_count === 1 ? "" : "s"}.</p>
                        </div>
                      ) : <p className="text-xs text-muted-foreground">No active work right now.</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Task Status</CardTitle></CardHeader>
                    <CardContent><DonutChart data={taskStatusDonutData} size={130} /></CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Man-Hours</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Planned</span><span className="tabular-nums">{dash?.man_hours.planned ?? 0}h</span></div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Actual</span><span className="tabular-nums">{dash?.man_hours.actual ?? 0}h</span></div>
                      <DeltaIndicator current={dash?.man_hours.actual ?? 0} previous={dash?.man_hours.planned ?? 0} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Project Insights</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {dashboardInsights.length === 0
                        ? <p className="text-xs text-muted-foreground">Not enough activity yet to surface insights.</p>
                        : dashboardInsights.map((ins, i) => (
                            <p key={i} className={`text-xs ${ins.tone === "success" ? "text-emerald-600 dark:text-emerald-400" : ins.tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{ins.text}</p>
                          ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="timeline" className="space-y-4 pt-4">
          <Card>
            <CardContent className="pt-6"><GanttChart phases={ganttPhases} milestones={ganttMilestones} rangeStart={ganttRangeStart} rangeEnd={ganttRangeEnd} /></CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Project Start</CardDescription><CalendarDays className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-lg font-semibold text-foreground">{project.start_date ?? "—"}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Target Completion</CardDescription><Flag className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-lg font-semibold text-foreground">{project.target_end_date ?? "—"}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Projected Completion</CardDescription><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent>
                <div className="text-lg font-semibold text-foreground">{projectedCompletionLabel ?? "—"}</div>
                {projectedCompletionDiffDays != null && projectedCompletionDiffDays !== 0 && (
                  <p className={`text-xs ${projectedCompletionDiffDays > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {Math.abs(projectedCompletionDiffDays)} day{Math.abs(projectedCompletionDiffDays) === 1 ? "" : "s"} {projectedCompletionDiffDays > 0 ? "late" : "early"}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Days Remaining</CardDescription><CalendarClock className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-lg font-semibold text-foreground">{daysRemaining ?? "—"}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Project Health</CardDescription><HeartPulse className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent>
                <div className={`text-lg font-semibold ${projectHealth === "LATE" ? "text-red-600 dark:text-red-400" : projectHealth === "AT_RISK" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {projectHealth === "LATE" ? "Late" : projectHealth === "AT_RISK" ? "At Risk" : projectHealth === "COMPLETED" ? "Completed" : "On Track"}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              {project.description && <p className="text-sm text-foreground">{project.description}</p>}
              <Can permission={PERMISSIONS.PRODUCTION_PROJECTS_UPDATE}>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={project.status} onValueChange={(v) => update.mutate({ id: project.id, patch: { status: v } })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "ARCHIVED"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Switch checked={project.client_portal_enabled} onCheckedChange={(checked) => update.mutate({ id: project.id, patch: { clientPortalEnabled: checked } })} disabled={!project.client_id} />
                  <div>
                    <p className="text-sm font-medium text-foreground">Client portal access</p>
                    <p className="text-xs text-muted-foreground">{project.client_id ? "Lets the linked client see shots and versions marked client-visible." : "Assign a client to this project first."}</p>
                  </div>
                </div>
              </Can>
            </CardContent>
          </Card>

          <CustomFieldsSection companyId={company?.id} entityType="PROJECT" entityId={project.id} />

          <ProductionFilesSection resourceType="PROJECT" resourceId={project.id} />

          <ProductionHistorySection resourceType="PROJECT" resourceId={project.id} />
        </TabsContent>

        <TabsContent value="insights" className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Task Status</h3>
              <DonutChart
                data={(insights?.task_status_counts ?? []).map((s) => ({ label: s.status, value: s.count, color: statusChartColor(s.status) }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Version Status</h3>
              <DonutChart
                data={(insights?.version_status_counts ?? []).map((s) => ({ label: s.status, value: s.count, color: statusChartColor(s.status) }))}
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Tasks Per Task Type</h3>
              {(() => {
                const rows = insights?.tasks_per_type ?? [];
                const statuses = [...new Set(rows.map((r) => r.status))];
                const types = [...new Set(rows.map((r) => r.task_type))];
                const series = statuses.map((s) => ({ key: s, label: s.replace(/_/g, " "), color: statusChartColor(s) }));
                const categories = types.map((t) => ({
                  label: t,
                  segments: statuses.map((s) => ({ key: s, value: rows.find((r) => r.task_type === t && r.status === s)?.count ?? 0, color: statusChartColor(s) })),
                }));
                return <StackedBarChart categories={categories} series={series} />;
              })()}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Versions Per Shot</h3>
              <HorizontalBarChart data={(insights?.versions_per_shot ?? []).map((s) => ({ label: s.shot_code, value: s.count }))} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-6 pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Shows</h3>
              <Can permission={PERMISSIONS.PRODUCTION_SHOWS_CREATE}>
                <Button size="sm" variant="outline" onClick={openCreateShow}>+ Show</Button>
              </Can>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(shows ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.description ?? "—"}</TableCell>
                      <TableCell>
                        <RowActions
                          canEdit={hasPermission(PERMISSIONS.PRODUCTION_SHOWS_UPDATE)}
                          canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                          onEdit={() => openEditShow(s)}
                          onDelete={() => setDeleteShowTarget(s)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!shows || shows.length === 0) && (
                    <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No shows yet — optional unless this project has multiple shows.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Episodes</h3>
              <Can permission={PERMISSIONS.PRODUCTION_EPISODES_CREATE}>
                <Button size="sm" variant="outline" onClick={openCreateEpisode}>+ Episode</Button>
              </Can>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(episodes ?? []).map((ep) => (
                    <TableRow key={ep.id}>
                      <TableCell className="font-mono text-xs">{ep.episode_code}</TableCell>
                      <TableCell>{ep.name ?? "—"}</TableCell>
                      <TableCell><ProductionStatusBadge status={ep.status} /></TableCell>
                      <TableCell>
                        <RowActions
                          canEdit={hasPermission(PERMISSIONS.PRODUCTION_EPISODES_UPDATE)}
                          canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                          onEdit={() => openEditEpisode(ep)}
                          onDelete={() => setDeleteEpisodeTarget(ep)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!episodes || episodes.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No episodes yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Sequences</h3>
              <Can permission={PERMISSIONS.PRODUCTION_SEQUENCES_CREATE}>
                <Button size="sm" onClick={openCreateSequence}>+ Sequence</Button>
              </Can>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader><TableRow><TableHead>Sequence</TableHead><TableHead>Episode</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
                <TableBody>
                  {(sequences ?? []).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.sequence_code}</TableCell>
                      <TableCell className="text-muted-foreground">{s.episode_id ? episodes?.find((e) => e.id === s.episode_id)?.episode_code ?? "—" : "—"}</TableCell>
                      <TableCell>{s.name ?? "—"}</TableCell>
                      <TableCell><ProductionStatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <RowActions
                          canEdit={hasPermission(PERMISSIONS.PRODUCTION_SEQUENCES_UPDATE)}
                          canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                          onEdit={() => openEditSequence(s)}
                          onDelete={() => setDeleteSequenceTarget(s)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!sequences || sequences.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No sequences yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_MEMBERS_MANAGE}>
              <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                <DialogTrigger asChild><Button size="sm">+ Add member</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add project member</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddMember} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Employee</Label>
                      <Select value={memberEmployeeId} onValueChange={setMemberEmployeeId}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select value={memberRole} onValueChange={setMemberRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["DIRECTOR", "PRODUCER", "SUPERVISOR", "ARTIST", "COORDINATOR", "CLIENT_LIAISON"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <DialogFooter><Button type="submit" disabled={memberMutations.add.isPending}>Add</Button></DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
              <TableBody>
                {(members ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{employeeMap.get(m.employee_id) ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.project_role}</TableCell>
                    <TableCell>
                      <Can permission={PERMISSIONS.PRODUCTION_MEMBERS_MANAGE}>
                        <Button variant="ghost" size="sm" onClick={() => memberMutations.remove.mutate(m.id)}>Remove</Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))}
                {(!members || members.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No members yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_MILESTONES_CREATE}>
              <Button size="sm" onClick={openCreateMilestone}>+ Milestone</Button>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {(milestones ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.milestone_code}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.due_date}</TableCell>
                    <TableCell><ProductionStatusBadge status={m.status} /></TableCell>
                    <TableCell>
                      <RowActions
                        canEdit={hasPermission(PERMISSIONS.PRODUCTION_MILESTONES_UPDATE)}
                        canDelete={hasPermission(PERMISSIONS.PRODUCTION_PROJECTS_MANAGE)}
                        onEdit={() => openEditMilestone(m)}
                        onDelete={() => setDeleteMilestoneTarget(m)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(!milestones || milestones.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No milestones yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="deliverables" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Can permission={PERMISSIONS.PRODUCTION_DELIVERABLES_CREATE}>
              <Button size="sm" onClick={openCreateDeliverable}>+ Deliverable</Button>
            </Can>
          </div>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
              <TableBody>
                {(deliverables ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.deliverable_code}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.due_date ?? "—"}</TableCell>
                    <TableCell><ProductionStatusBadge status={d.status} /></TableCell>
                    <TableCell>
                      <RowActions
                        canEdit={hasPermission(PERMISSIONS.PRODUCTION_DELIVERABLES_UPDATE)}
                        canDelete={hasPermission(PERMISSIONS.PRODUCTION_DELIVERABLES_UPDATE)}
                        onEdit={() => openEditDeliverable(d)}
                        onDelete={() => setDeleteDeliverableTarget(d)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {(!deliverables || deliverables.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No deliverables yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4 pt-4">
          <Card>
            <CardContent className="pt-6">
              {!project.budget_id ? (
                <p className="text-sm text-muted-foreground">No budget linked to this project yet. Link one from Finance &gt; Budgets.</p>
              ) : budgetSummary ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-semibold text-foreground">{budgetSummary.total_budget} {budgetSummary.currency_code}</p></div>
                  <div><p className="text-xs text-muted-foreground">Allocated</p><p className="text-lg font-semibold text-foreground">{budgetSummary.allocated}</p></div>
                  <div><p className="text-xs text-muted-foreground">Spent</p><p className="text-lg font-semibold text-foreground">{budgetSummary.spent}</p></div>
                  <div><p className="text-xs text-muted-foreground">Remaining</p><p className="text-lg font-semibold text-foreground">{budgetSummary.remaining}</p></div>
                </div>
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- Edit / Create dialogs ---- */}

      <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit project</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveProject} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={projectName} onChange={(e) => setProjectName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Task workflow</Label>
              <Select value={projectTaskWorkflowId || "__default__"} onValueChange={(v) => setProjectTaskWorkflowId(v === "__default__" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Default (all statuses)</SelectItem>
                  {taskWorkflowTemplates.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Controls the status options on this project's Task Board and task rows. Defined under Production &gt; Settings &gt; Workflows.</p>
            </div>
            <DialogFooter><Button type="submit" disabled={update.isPending}>Save changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingShow ? "Edit show" : "New show"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveShow} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={showName} onChange={(e) => setShowName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={showDescription} onChange={(e) => setShowDescription(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={hierarchy.createShow.isPending || hierarchy.updateShow.isPending}>{editingShow ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={episodeOpen} onOpenChange={setEpisodeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingEpisode ? "Edit episode" : "New episode"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEpisode} className="space-y-3">
            {!editingEpisode && (
              <div className="space-y-1.5"><Label>Episode number</Label><Input type="number" min={1} required value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} /></div>
            )}
            {editingEpisode && (
              <>
                <div className="space-y-1.5"><Label>Name</Label><Input value={episodeName} onChange={(e) => setEpisodeName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={episodeStatus} onValueChange={setEpisodeStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EPISODE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <DialogFooter><Button type="submit" disabled={hierarchy.createEpisode.isPending || hierarchy.updateEpisode.isPending}>{editingEpisode ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={sequenceOpen} onOpenChange={setSequenceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSequence ? "Edit sequence" : "New sequence"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveSequence} className="space-y-3">
            {!editingSequence && (
              <>
                <div className="space-y-1.5">
                  <Label>Episode (optional)</Label>
                  <Select value={sequenceEpisodeId} onValueChange={setSequenceEpisodeId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>{(episodes ?? []).map((ep) => <SelectItem key={ep.id} value={ep.id}>{ep.episode_code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Sequence number</Label><Input type="number" min={1} required value={sequenceNumber} onChange={(e) => setSequenceNumber(e.target.value)} /></div>
              </>
            )}
            {editingSequence && (
              <>
                <div className="space-y-1.5"><Label>Name</Label><Input value={sequenceName} onChange={(e) => setSequenceName(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={sequenceStatus} onValueChange={setSequenceStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEQUENCE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <DialogFooter><Button type="submit" disabled={hierarchy.createSequence.isPending || hierarchy.updateSequence.isPending}>{editingSequence ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={milestoneOpen} onOpenChange={setMilestoneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMilestone ? "Edit milestone" : "New milestone"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveMilestone} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" required value={milestoneDue} onChange={(e) => setMilestoneDue(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={milestoneMutations.create.isPending || milestoneMutations.update.isPending}>{editingMilestone ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deliverableOpen} onOpenChange={setDeliverableOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDeliverable ? "Edit deliverable" : "New deliverable"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveDeliverable} className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input required value={deliverableName} onChange={(e) => setDeliverableName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={deliverableDue} onChange={(e) => setDeliverableDue(e.target.value)} /></div>
            <DialogFooter><Button type="submit" disabled={deliverableMutations.create.isPending || deliverableMutations.update.isPending}>{editingDeliverable ? "Save changes" : "Create"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Delete confirmations ---- */}

      <AlertDialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and everything under it — shows, episodes, sequences, shots, assets, tasks, versions, milestones, and deliverables. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject}>Delete project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteShowTarget} onOpenChange={(open) => !open && setDeleteShowTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteShowTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteShow}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteEpisodeTarget} onOpenChange={(open) => !open && setDeleteEpisodeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteEpisodeTarget?.episode_code}?</AlertDialogTitle>
            <AlertDialogDescription>Any sequences and shots under this episode will also be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEpisode}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSequenceTarget} onOpenChange={(open) => !open && setDeleteSequenceTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteSequenceTarget?.sequence_code}?</AlertDialogTitle>
            <AlertDialogDescription>Any shots under this sequence will also be deleted. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSequence}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteMilestoneTarget} onOpenChange={(open) => !open && setDeleteMilestoneTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteMilestoneTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMilestone}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDeliverableTarget} onOpenChange={(open) => !open && setDeleteDeliverableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteDeliverableTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDeliverable}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
