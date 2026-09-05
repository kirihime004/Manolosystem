import { Fragment, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  MoreHorizontal, Clapperboard, ListChecks, CalendarClock, HeartPulse, CalendarDays, Flag, Clock,
  Search, Download, CheckCircle2, PauseCircle, AlertCircle, Shapes, LayoutGrid, List as ListIcon, GitBranch,
  MessageSquare,
} from "lucide-react";
import { useCompany } from "@/lib/tenant/useCompany";
import {
  useProject, useProjectMutations, useShows, useEpisodes, useSequences, useHierarchyMutations,
  useProjectMembers, useProjectMemberMutations, useMilestones, useMilestoneMutations,
  useDeliverables, useDeliverableMutations, useProductionBudgetSummary, useWorkflowTemplates,
  useProjectInsights, useProjectDashboard, useTasks, useTaskTypes, useShots, useAssets, useAssetMutations,
  useVersions, useReviews, useProjectNotes, useProjectNoteMutations, useAllWorkEarnings, useProductionUnits,
} from "@/features/production/hooks";
import { useAuth } from "@/lib/auth/useAuth";
import { exportCsv } from "@/lib/csvExport";
import { CustomFieldsSection } from "@/components/production/CustomFieldsSection";
import { ProductionFilesSection } from "@/components/production/ProductionFilesSection";
import { ProductionHistorySection } from "@/components/production/ProductionHistorySection";
import {
  DonutChart, StackedBarChart, HorizontalBarChart, PhaseTimelineChart, GanttChart, statusChartColor,
  bucketTaskStatusCounts, DeltaIndicator, type GanttPhaseRow, type GanttPhaseStatus,
} from "@/components/production/charts/ProductionCharts";
import { useEmployees, useMyEmployeeRecord } from "@/features/hr/hooks";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { ProductionStatusBadge, ProductionPriorityBadge } from "@/components/shared/ProductionBadges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Can } from "@/lib/permissions/Can";
import { PERMISSIONS } from "@/lib/permissions/keys";
import type { ProductionEpisode, ProductionMilestone, ProductionDeliverable, ProductionSequence, ProductionShow, ProductionTask, ProductionNote } from "@/types/database";

const ASSET_CATEGORIES = ["CHARACTER", "PROP", "ENVIRONMENT", "VEHICLE", "RIG", "EFFECT", "OTHER"] as const;

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
  const { data: projectShots } = useShots(projectId);
  const { data: projectAssets } = useAssets(projectId);
  const assetMutations = useAssetMutations(projectId);
  const { data: projectVersions } = useVersions({ projectId });
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const effectiveSelectedVersionId = selectedVersionId ?? projectVersions?.[0]?.id;
  const { data: selectedVersionReviews } = useReviews(effectiveSelectedVersionId);
  const { user } = useAuth();
  const { data: myEmployee } = useMyEmployeeRecord(company?.id, user?.id);
  const noteResourceIds = [
    ...(projectShots ?? []).map((s) => s.id),
    ...(projectAssets ?? []).map((a) => a.id),
    ...(allTasks ?? []).map((t) => t.id),
  ];
  const { data: projectNotes } = useProjectNotes(noteResourceIds);
  const noteMutations = useProjectNoteMutations(noteResourceIds);
  const { data: allCompanyWorkEarnings } = useAllWorkEarnings(company?.id);
  const { data: productionUnits } = useProductionUnits(company?.id);
  const { data: workflowTemplates } = useWorkflowTemplates(company?.id);
  const taskWorkflowTemplates = (workflowTemplates ?? []).filter((w) => w.entity_type === "TASK");

  // Tasks tab: filters (client-side over allTasks, mirroring the mockup's
  // stage/status/assignee/search filter bar and List/Group-by-Stage toggle)
  const [taskStageFilter, setTaskStageFilter] = useState("__all__");
  const [taskStatusFilter, setTaskStatusFilter] = useState("__all__");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("__all__");
  const [taskSearch, setTaskSearch] = useState("");
  const [tasksGroupByStage, setTasksGroupByStage] = useState(false);

  // Assets tab
  const [assetCategoryFilter, setAssetCategoryFilter] = useState("__all__");
  const [assetStatusFilter, setAssetStatusFilter] = useState("__all__");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetViewMode, setAssetViewMode] = useState<"grid" | "list">("grid");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetCreateOpen, setAssetCreateOpen] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetCategory, setNewAssetCategory] = useState<(typeof ASSET_CATEGORIES)[number]>("PROP");

  // Approvals tab
  const [approvalStatusFilter, setApprovalStatusFilter] = useState("__all__");

  // Notes tab
  const [noteStatusFilter, setNoteStatusFilter] = useState("__all__");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

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

  // ---- Tasks tab derived values ----
  const shotCodeMap = new Map((projectShots ?? []).map((s) => [s.id, s.shot_code]));
  const assetCodeMap = new Map((projectAssets ?? []).map((a) => [a.id, a.asset_code]));
  const todayIso = new Date().toISOString().slice(0, 10);

  // No explicit numeric progress field exists on a task -- only status and
  // planned start/due dates -- so progress is derived: 100%/0% for a task
  // that's finished/not started yet, otherwise a linear estimate of how far
  // through its own planned window "today" falls (clamped so an in-flight
  // task never shows as fully done or fully untouched).
  const taskProgressPct = (t: ProductionTask): number => {
    if (t.status === "COMPLETED" || t.status === "APPROVED") return 100;
    if (t.status === "NOT_STARTED") return 0;
    if (!t.start_date || !t.due_date) return 50;
    const start = new Date(t.start_date).getTime();
    const end = new Date(t.due_date).getTime();
    if (end <= start) return 50;
    const frac = (Date.now() - start) / (end - start);
    return Math.round(Math.min(95, Math.max(5, frac * 100)));
  };

  const taskCounts = {
    total: allTasks?.length ?? 0,
    completed: (allTasks ?? []).filter((t) => t.status === "COMPLETED" || t.status === "APPROVED").length,
    inProgress: (allTasks ?? []).filter((t) => t.status === "IN_PROGRESS" || t.status === "READY").length,
    onHold: (allTasks ?? []).filter((t) => t.status === "ON_HOLD").length,
    overdue: (allTasks ?? []).filter((t) => t.due_date && t.due_date < todayIso && t.status !== "COMPLETED" && t.status !== "APPROVED").length,
  };

  const taskStatusOptions = [...new Set((allTasks ?? []).map((t) => t.status))];
  const filteredTasks = (allTasks ?? []).filter((t) => {
    if (taskStageFilter !== "__all__" && (t.task_type_id ?? "__unassigned__") !== taskStageFilter) return false;
    if (taskStatusFilter !== "__all__" && t.status !== taskStatusFilter) return false;
    if (taskAssigneeFilter !== "__all__" && (t.assigned_to ?? "__unassigned__") !== taskAssigneeFilter) return false;
    if (taskSearch && !t.name.toLowerCase().includes(taskSearch.toLowerCase())) return false;
    return true;
  });
  const taskGroups: { key: string; label: string; tasks: ProductionTask[] }[] = tasksGroupByStage
    ? [...taskTypeMap.values()].map((tt) => ({ key: tt.id, label: tt.name, tasks: filteredTasks.filter((t) => t.task_type_id === tt.id) }))
        .concat([{ key: "__unassigned__", label: "Unassigned", tasks: filteredTasks.filter((t) => !t.task_type_id) }])
        .filter((g) => g.tasks.length > 0)
    : [{ key: "__all__", label: "", tasks: filteredTasks }];

  const handleExportTasks = () => {
    exportCsv(`${project.project_code}-tasks-${todayIso}.csv`, [
      { label: "Task", render: (t: ProductionTask) => t.name },
      { label: "Stage", render: (t: ProductionTask) => taskTypeMap.get(t.task_type_id ?? "")?.name ?? "Unassigned" },
      { label: "Shot/Asset", render: (t: ProductionTask) => (t.shot_id ? shotCodeMap.get(t.shot_id) : t.asset_id ? assetCodeMap.get(t.asset_id) : "") ?? "" },
      { label: "Assignee", render: (t: ProductionTask) => (t.assigned_to ? employeeMap.get(t.assigned_to) : "") ?? "" },
      { label: "Priority", render: (t: ProductionTask) => t.priority },
      { label: "Status", render: (t: ProductionTask) => t.status },
      { label: "Planned Start", render: (t: ProductionTask) => t.start_date ?? "" },
      { label: "Planned End", render: (t: ProductionTask) => t.due_date ?? "" },
      { label: "Progress %", render: (t: ProductionTask) => String(taskProgressPct(t)) },
    ], filteredTasks);
  };

  // ---- Assets tab derived values ----
  const assetStatusOptions = [...new Set((projectAssets ?? []).map((a) => a.status))];
  const filteredAssets = (projectAssets ?? []).filter((a) => {
    if (assetCategoryFilter !== "__all__" && a.asset_category !== assetCategoryFilter) return false;
    if (assetStatusFilter !== "__all__" && a.status !== assetStatusFilter) return false;
    if (assetSearch && !a.name.toLowerCase().includes(assetSearch.toLowerCase())) return false;
    return true;
  });
  const selectedAsset = (projectAssets ?? []).find((a) => a.id === selectedAssetId) ?? null;
  const handleCreateAsset = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await assetMutations.create.mutateAsync({ companyId: company!.id, projectId: project.id, name: newAssetName, assetCategory: newAssetCategory });
      toast.success("Asset created");
      setAssetCreateOpen(false); setNewAssetName("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create asset"); }
  };

  // ---- Approvals tab derived values ----
  const approvalCounts = {
    approved: (projectVersions ?? []).filter((v) => v.status === "APPROVED").length,
    inReview: (projectVersions ?? []).filter((v) => v.status === "PENDING_REVIEW").length,
    changesRequested: (projectVersions ?? []).filter((v) => v.status === "CHANGES_REQUESTED").length,
    archived: (projectVersions ?? []).filter((v) => v.status === "ARCHIVED").length,
  };
  const filteredVersions = (projectVersions ?? []).filter((v) => approvalStatusFilter === "__all__" || v.status === approvalStatusFilter);
  const selectedVersion = (projectVersions ?? []).find((v) => v.id === effectiveSelectedVersionId) ?? filteredVersions[0] ?? null;

  // ---- Team tab derived values ----
  const openTasksByEmployee = new Map<string, number>();
  for (const t of allTasks ?? []) {
    if (!t.assigned_to || t.status === "COMPLETED" || t.status === "APPROVED") continue;
    openTasksByEmployee.set(t.assigned_to, (openTasksByEmployee.get(t.assigned_to) ?? 0) + 1);
  }
  const teamRows = (members ?? []).map((m) => ({
    member: m,
    name: employeeMap.get(m.employee_id) ?? "—",
    openTaskCount: openTasksByEmployee.get(m.employee_id) ?? 0,
  }));
  const avgOpenTasks = teamRows.length ? teamRows.reduce((s, r) => s + r.openTaskCount, 0) / teamRows.length : 0;
  const maxOpenTasks = Math.max(1, ...teamRows.map((r) => r.openTaskCount));
  const overloadedCount = teamRows.filter((r) => avgOpenTasks > 0 && r.openTaskCount > avgOpenTasks * 1.5).length;
  const onTrackCount = teamRows.length - overloadedCount;
  const departmentCounts = new Map<string, number>();
  for (const r of teamRows) {
    const dept = r.member.department ?? "Unassigned";
    departmentCounts.set(dept, (departmentCounts.get(dept) ?? 0) + 1);
  }
  const DEPARTMENT_COLORS = ["#6366f1", "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];
  const departmentDonutData = [...departmentCounts.entries()].map(([label, value], i) => ({
    label, value, color: DEPARTMENT_COLORS[i % DEPARTMENT_COLORS.length],
  }));

  // ---- Notes tab derived values ----
  const taskNameMap = new Map((allTasks ?? []).map((t) => [t.id, t.name]));
  const shotIdSet = new Set((projectShots ?? []).map((s) => s.id));
  const assetIdSet = new Set((projectAssets ?? []).map((a) => a.id));
  const resolveNoteResource = (n: ProductionNote): { label: string; href: string | null } => {
    if (n.resource_type === "SHOT" && shotIdSet.has(n.resource_id)) return { label: `Shot ${shotCodeMap.get(n.resource_id) ?? ""}`, href: `/c/${company?.slug}/production/shots/${n.resource_id}` };
    if (n.resource_type === "ASSET" && assetIdSet.has(n.resource_id)) return { label: `Asset ${assetCodeMap.get(n.resource_id) ?? ""}`, href: `/c/${company?.slug}/production/assets/${n.resource_id}` };
    if (n.resource_type === "TASK") return { label: `Task ${taskNameMap.get(n.resource_id) ?? ""}`, href: null };
    return { label: n.resource_type, href: null };
  };
  const topLevelNotes = (projectNotes ?? []).filter((n) => !n.parent_note_id);
  const noteCounts = { total: topLevelNotes.length, open: topLevelNotes.filter((n) => n.status === "OPEN").length, resolved: topLevelNotes.filter((n) => n.status === "RESOLVED").length };
  const filteredNotes = topLevelNotes.filter((n) => noteStatusFilter === "__all__" || n.status === noteStatusFilter);
  const effectiveSelectedNoteId = selectedNoteId ?? filteredNotes[0]?.id ?? null;
  const selectedNote = (projectNotes ?? []).find((n) => n.id === effectiveSelectedNoteId) ?? null;
  const selectedNoteReplies = (projectNotes ?? []).filter((n) => n.parent_note_id === effectiveSelectedNoteId);
  const handleResolveNote = async (id: string) => {
    if (!myEmployee) { toast.error("No employee record linked to your account"); return; }
    try {
      await noteMutations.resolve.mutateAsync({ id, resolvedBy: myEmployee.id });
      toast.success("Note resolved");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to resolve note"); }
  };

  // ---- Payments tab derived values ----
  const PENDING_EARNING_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PAYABLE", "SENT_TO_FINANCE", "IN_PAYROLL"];
  const projectWorkEarnings = (allCompanyWorkEarnings ?? []).filter((w) => w.project_id === project.id);
  const earningAmount = (w: (typeof projectWorkEarnings)[number]) => w.approved_amount ?? w.requested_amount;
  const paymentTotals = {
    budget: projectWorkEarnings.filter((w) => w.status !== "REJECTED" && w.status !== "CANCELLED").reduce((s, w) => s + earningAmount(w), 0),
    paid: projectWorkEarnings.filter((w) => w.status === "PAID").reduce((s, w) => s + earningAmount(w), 0),
    pending: projectWorkEarnings.filter((w) => PENDING_EARNING_STATUSES.includes(w.status)).reduce((s, w) => s + earningAmount(w), 0),
  };
  const unitLabelMap = new Map((productionUnits ?? []).map((u) => [u.id, u.label]));

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
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="hierarchy">Episodes & Sequences</TabsTrigger>
          <TabsTrigger value="members">Team</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
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

        <TabsContent value="tasks" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Total Tasks</CardDescription><ListChecks className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{taskCounts.total}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Completed</CardDescription><CheckCircle2 className="h-4 w-4 text-emerald-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{taskCounts.completed} <span className="text-sm font-normal text-muted-foreground">({taskCounts.total ? Math.round(100 * taskCounts.completed / taskCounts.total) : 0}%)</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>In Progress</CardDescription><Clock className="h-4 w-4 text-blue-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{taskCounts.inProgress} <span className="text-sm font-normal text-muted-foreground">({taskCounts.total ? Math.round(100 * taskCounts.inProgress / taskCounts.total) : 0}%)</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>On Hold</CardDescription><PauseCircle className="h-4 w-4 text-amber-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{taskCounts.onHold} <span className="text-sm font-normal text-muted-foreground">({taskCounts.total ? Math.round(100 * taskCounts.onHold / taskCounts.total) : 0}%)</span></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Overdue</CardDescription><AlertCircle className="h-4 w-4 text-red-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{taskCounts.overdue} <span className="text-sm font-normal text-muted-foreground">({taskCounts.total ? Math.round(100 * taskCounts.overdue / taskCounts.total) : 0}%)</span></div></CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={taskStageFilter} onValueChange={setTaskStageFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Stages</SelectItem>
                {(taskTypes ?? []).map((tt) => <SelectItem key={tt.id} value={tt.id}>{tt.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {taskStatusOptions.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Assignees</SelectItem>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-48 pl-8" placeholder="Search tasks…" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant={tasksGroupByStage ? "default" : "outline"} size="sm" onClick={() => setTasksGroupByStage((v) => !v)}>Group by Stage</Button>
              <Can permission={PERMISSIONS.PRODUCTION_REPORTS_EXPORT}>
                <Button variant="outline" size="sm" onClick={handleExportTasks}><Download className="h-3.5 w-3.5" />Export</Button>
              </Can>
              <Button variant="outline" size="sm" asChild><Link to={`/c/${company?.slug}/production/tasks?project=${project.id}`}>Board</Link></Button>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState icon={ListChecks} title="No tasks match these filters" description="Clear a filter, or create tasks from the Task Board." />
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Shot / Asset</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Planned Start</TableHead>
                      <TableHead>Planned End</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-right">Days Left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskGroups.map((group) => (
                      <Fragment key={group.key}>
                        {group.label && (
                          <TableRow key={`${group.key}-header`} className="bg-muted/40 hover:bg-muted/40">
                            <TableCell colSpan={10} className="py-1.5 text-xs font-semibold text-muted-foreground">{group.label} ({group.tasks.length})</TableCell>
                          </TableRow>
                        )}
                        {group.tasks.map((t) => {
                          const assigneeName = t.assigned_to ? employeeMap.get(t.assigned_to) : null;
                          const shotOrAssetCode = t.shot_id ? shotCodeMap.get(t.shot_id) : t.asset_id ? assetCodeMap.get(t.asset_id) : null;
                          const daysLeft = t.due_date ? Math.round((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null;
                          const progress = taskProgressPct(t);
                          return (
                            <TableRow key={t.id}>
                              <TableCell className="font-medium text-foreground">{t.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{taskTypeMap.get(t.task_type_id ?? "")?.name ?? "Unassigned"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{shotOrAssetCode ?? "—"}</TableCell>
                              <TableCell>
                                {assigneeName ? (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar size="sm"><AvatarFallback>{assigneeName.split(" ").map((p) => p[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                                    <span className="text-sm text-muted-foreground">{assigneeName}</span>
                                  </div>
                                ) : <span className="text-sm text-muted-foreground">Unassigned</span>}
                              </TableCell>
                              <TableCell><ProductionPriorityBadge priority={t.priority} /></TableCell>
                              <TableCell><ProductionStatusBadge status={t.status} /></TableCell>
                              <TableCell className="text-sm text-muted-foreground">{t.start_date ?? "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{t.due_date ?? "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/40"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
                                  <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                                </div>
                              </TableCell>
                              <TableCell className={`text-right text-sm tabular-nums ${daysLeft != null && daysLeft < 0 && progress < 100 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                {daysLeft == null ? "—" : daysLeft < 0 ? `${-daysLeft}d overdue` : `${daysLeft}d`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="assets" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["__all__", ...ASSET_CATEGORIES] as const).map((cat) => {
              const count = cat === "__all__" ? (projectAssets ?? []).length : (projectAssets ?? []).filter((a) => a.asset_category === cat).length;
              return (
                <Button key={cat} size="sm" variant={assetCategoryFilter === cat ? "default" : "outline"} onClick={() => setAssetCategoryFilter(cat)}>
                  {cat === "__all__" ? "All Assets" : cat.charAt(0) + cat.slice(1).toLowerCase()} ({count})
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={assetStatusFilter} onValueChange={setAssetStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {assetStatusOptions.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-48 pl-8" placeholder="Search assets…" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-md border border-border">
                <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-r-none ${assetViewMode === "grid" ? "bg-muted" : ""}`} onClick={() => setAssetViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-l-none ${assetViewMode === "list" ? "bg-muted" : ""}`} onClick={() => setAssetViewMode("list")}><ListIcon className="h-4 w-4" /></Button>
              </div>
              <Can permission={PERMISSIONS.PRODUCTION_ASSETS_CREATE}>
                <Dialog open={assetCreateOpen} onOpenChange={setAssetCreateOpen}>
                  <DialogTrigger asChild><Button size="sm">+ Add Asset</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New asset</DialogTitle></DialogHeader>
                    <form onSubmit={handleCreateAsset} className="space-y-3">
                      <div className="space-y-1.5"><Label>Name</Label><Input required value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)} /></div>
                      <div className="space-y-1.5">
                        <Label>Category</Label>
                        <Select value={newAssetCategory} onValueChange={(v) => setNewAssetCategory(v as typeof newAssetCategory)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ASSET_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <DialogFooter><Button type="submit" disabled={assetMutations.create.isPending}>Create</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </Can>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <EmptyState icon={Shapes} title="No assets match these filters" description="Clear a filter, or add the first asset for this project." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className={assetViewMode === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-2 xl:grid-cols-4" : "space-y-2 lg:col-span-2"}>
                {filteredAssets.map((a) => {
                  const isSelected = (selectedAssetId ?? filteredAssets[0]?.id) === a.id;
                  return assetViewMode === "grid" ? (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAssetId(a.id)}
                      className={`rounded-lg border text-left transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="flex aspect-square items-center justify-center rounded-t-lg bg-muted/40">
                        <Shapes className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-1 p-2">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-xs font-medium text-foreground" title={a.name}>{a.name}</p>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] text-muted-foreground">{a.asset_code}</span>
                          <ProductionStatusBadge status={a.status} />
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAssetId(a.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted/40"><Shapes className="h-5 w-5 text-muted-foreground" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{a.asset_code} · {a.asset_category}</p>
                      </div>
                      <ProductionStatusBadge status={a.status} />
                    </button>
                  );
                })}
              </div>

              <Card className="h-fit lg:sticky lg:top-4">
                <CardContent className="space-y-3 pt-6">
                  {(() => {
                    const shown = selectedAsset ?? filteredAssets[0];
                    if (!shown) return <p className="text-xs text-muted-foreground">Select an asset to see its details.</p>;
                    return (
                      <>
                        <div className="flex aspect-video items-center justify-center rounded-lg bg-muted/40"><Shapes className="h-10 w-10 text-muted-foreground" /></div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">{shown.asset_code}</p>
                            <p className="text-sm font-semibold text-foreground">{shown.name}</p>
                          </div>
                          <ProductionStatusBadge status={shown.status} />
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Category</span><span className="text-foreground">{shown.asset_category}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Created</span><span className="text-foreground">{shown.created_at.slice(0, 10)}</span></div>
                          <div className="flex items-center justify-between"><span className="text-muted-foreground">Updated</span><span className="text-foreground">{shown.updated_at.slice(0, 10)}</span></div>
                        </div>
                        {shown.description && <p className="text-xs text-muted-foreground">{shown.description}</p>}
                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <Link to={`/c/${company?.slug}/production/assets/${shown.id}`}>Open full details</Link>
                        </Button>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Approved</CardDescription><CheckCircle2 className="h-4 w-4 text-emerald-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{approvalCounts.approved}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>In Review</CardDescription><Clock className="h-4 w-4 text-amber-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{approvalCounts.inReview}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Changes Requested</CardDescription><AlertCircle className="h-4 w-4 text-blue-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{approvalCounts.changesRequested}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Archived</CardDescription><PauseCircle className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{approvalCounts.archived}</div></CardContent>
            </Card>
          </div>

          <Select value={approvalStatusFilter} onValueChange={setApprovalStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              <SelectItem value="PENDING_REVIEW">In Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="CHANGES_REQUESTED">Changes Requested</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          {filteredVersions.length === 0 ? (
            <EmptyState icon={GitBranch} title="No versions match these filters" description="Versions submitted for review on any shot or asset in this project show up here." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-card lg:col-span-2">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Version</TableHead><TableHead>Shot / Asset</TableHead><TableHead>Submitted By</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVersions.map((v) => {
                      const code = v.shot_id ? shotCodeMap.get(v.shot_id) : v.asset_id ? assetCodeMap.get(v.asset_id) : null;
                      return (
                        <TableRow
                          key={v.id}
                          className={`cursor-pointer ${(selectedVersionId ?? filteredVersions[0]?.id) === v.id ? "bg-muted/50" : ""}`}
                          onClick={() => setSelectedVersionId(v.id)}
                        >
                          <TableCell className="font-medium text-foreground">v{v.version_number}{v.name ? ` — ${v.name}` : ""}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{code ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{v.submitted_by ? employeeMap.get(v.submitted_by) ?? "—" : "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(v.submitted_at).toLocaleDateString()}</TableCell>
                          <TableCell><ProductionStatusBadge status={v.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Card className="h-fit lg:sticky lg:top-4">
                <CardContent className="space-y-3 pt-6">
                  {!selectedVersion ? (
                    <p className="text-xs text-muted-foreground">Select a version to see its review history.</p>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-semibold text-foreground">v{selectedVersion.version_number}{selectedVersion.name ? ` — ${selectedVersion.name}` : ""}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedVersion.shot_id ? `Shot ${shotCodeMap.get(selectedVersion.shot_id) ?? ""}` : selectedVersion.asset_id ? `Asset ${assetCodeMap.get(selectedVersion.asset_id) ?? ""}` : ""}
                        </p>
                      </div>
                      <ProductionStatusBadge status={selectedVersion.status} />
                      {selectedVersion.description && <p className="text-xs text-muted-foreground">{selectedVersion.description}</p>}
                      <div className="space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-semibold text-foreground">Review History</p>
                        {(selectedVersionReviews ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No review decisions yet.</p>
                        ) : (
                          (selectedVersionReviews ?? []).map((r) => (
                            <div key={r.id} className="text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-foreground">{r.reviewer_name ?? (r.reviewer_employee_id ? employeeMap.get(r.reviewer_employee_id) : null) ?? "Reviewer"}</span>
                                <ProductionStatusBadge status={r.decision} />
                              </div>
                              {r.comment && <p className="mt-0.5 text-muted-foreground">{r.comment}</p>}
                            </div>
                          ))
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <Link to={selectedVersion.shot_id ? `/c/${company?.slug}/production/shots/${selectedVersion.shot_id}` : `/c/${company?.slug}/production/assets/${selectedVersion.asset_id}`}>
                          Open full review
                        </Link>
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Team Members</CardDescription><ListChecks className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{teamRows.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Tasks Assigned</CardDescription><Clapperboard className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{teamRows.reduce((s, r) => s + r.openTaskCount, 0)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>On Track</CardDescription><CheckCircle2 className="h-4 w-4 text-emerald-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{onTrackCount}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Overloaded</CardDescription><AlertCircle className="h-4 w-4 text-amber-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{overloadedCount}</div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card lg:col-span-2">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Current Tasks</TableHead><TableHead>Workload</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {teamRows.map((r) => {
                    const overloaded = avgOpenTasks > 0 && r.openTaskCount > avgOpenTasks * 1.5;
                    return (
                      <TableRow key={r.member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm"><AvatarFallback>{r.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
                            <span className="font-medium text-foreground">{r.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.member.project_role}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.member.department ?? "—"}</TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">{r.openTaskCount}</TableCell>
                        <TableCell>
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted/40">
                            <div className={`h-full rounded-full ${overloaded ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.round((r.openTaskCount / maxOpenTasks) * 100)}%` }} />
                          </div>
                        </TableCell>
                        <TableCell>
                          {overloaded ? <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Overloaded</span> : <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">On Track</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {teamRows.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No team members yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Team by Department</CardTitle></CardHeader>
              <CardContent><DonutChart data={departmentDonutData} size={140} /></CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between pt-2">
            <h3 className="text-sm font-semibold text-foreground">Manage Members</h3>
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

        <TabsContent value="notes" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Total Notes</CardDescription><MessageSquare className="h-4 w-4 text-muted-foreground" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{noteCounts.total}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Open</CardDescription><AlertCircle className="h-4 w-4 text-amber-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{noteCounts.open}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><CardDescription>Resolved</CardDescription><CheckCircle2 className="h-4 w-4 text-emerald-500" /></CardHeader>
              <CardContent><div className="text-2xl font-semibold tabular-nums text-foreground">{noteCounts.resolved}</div></CardContent>
            </Card>
          </div>

          <Select value={noteStatusFilter} onValueChange={setNoteStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Notes</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>

          {filteredNotes.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No notes yet" description="Notes left on any shot, asset, or task in this project show up here." />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-card lg:col-span-2">
                <Table>
                  <TableHeader><TableRow><TableHead>Note</TableHead><TableHead>On</TableHead><TableHead>Author</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredNotes.map((n) => {
                      const resource = resolveNoteResource(n);
                      return (
                        <TableRow key={n.id} className={`cursor-pointer ${effectiveSelectedNoteId === n.id ? "bg-muted/50" : ""}`} onClick={() => setSelectedNoteId(n.id)}>
                          <TableCell className="max-w-xs truncate text-sm font-medium text-foreground">{n.content}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{resource.label}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{n.author_id ? employeeMap.get(n.author_id) ?? "—" : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>{n.status === "OPEN" ? <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Open</span> : <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Resolved</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Card className="h-fit lg:sticky lg:top-4">
                <CardContent className="space-y-3 pt-6">
                  {!selectedNote ? (
                    <p className="text-xs text-muted-foreground">Select a note to see the full thread.</p>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-muted-foreground">{resolveNoteResource(selectedNote).label}</p>
                        {selectedNote.status === "OPEN" ? <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Open</span> : <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Resolved</span>}
                      </div>
                      <p className="text-sm text-foreground">{selectedNote.content}</p>
                      <p className="text-xs text-muted-foreground">{selectedNote.author_id ? employeeMap.get(selectedNote.author_id) ?? "—" : "—"} · {new Date(selectedNote.created_at).toLocaleString()}</p>
                      {selectedNoteReplies.length > 0 && (
                        <div className="space-y-2 border-t border-border pt-3">
                          <p className="text-xs font-semibold text-foreground">Replies</p>
                          {selectedNoteReplies.map((r) => (
                            <div key={r.id} className="text-xs">
                              <p className="font-medium text-foreground">{r.author_id ? employeeMap.get(r.author_id) ?? "—" : "—"}</p>
                              <p className="text-muted-foreground">{r.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {selectedNote.status === "OPEN" && (
                        <Can permission={PERMISSIONS.PRODUCTION_NOTES_RESOLVE}>
                          <Button size="sm" variant="outline" className="w-full" onClick={() => handleResolveNote(selectedNote.id)}>Mark Resolved</Button>
                        </Can>
                      )}
                      {resolveNoteResource(selectedNote).href && (
                        <Button size="sm" variant="ghost" className="w-full" asChild><Link to={resolveNoteResource(selectedNote).href!}>Open full thread</Link></Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
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

        <TabsContent value="payments" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardDescription>Total Task Budget</CardDescription></CardHeader>
              <CardContent><div className="text-xl font-semibold text-foreground"><Money amount={paymentTotals.budget} currencyId={projectWorkEarnings[0]?.currency_id} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Total Paid</CardDescription></CardHeader>
              <CardContent><div className="text-xl font-semibold text-emerald-600 dark:text-emerald-400"><Money amount={paymentTotals.paid} currencyId={projectWorkEarnings[0]?.currency_id} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardDescription>Pending Payment</CardDescription></CardHeader>
              <CardContent><div className="text-xl font-semibold text-amber-600 dark:text-amber-400"><Money amount={paymentTotals.pending} currencyId={projectWorkEarnings[0]?.currency_id} /></div></CardContent>
            </Card>
          </div>

          {projectWorkEarnings.length === 0 ? (
            <EmptyState icon={ListChecks} title="No task payments yet" description="Approved work submitted against this project's tasks shows up here." />
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Qty / Unit</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectWorkEarnings.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="text-sm font-medium text-foreground">{taskNameMap.get(w.task_id) ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{employeeMap.get(w.employee_id) ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground"><Money amount={w.rate} currencyId={w.currency_id} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{w.approved_quantity ?? w.requested_quantity} {unitLabelMap.get(w.production_unit_id) ?? ""}</TableCell>
                        <TableCell className="text-sm font-medium text-foreground"><Money amount={earningAmount(w)} currencyId={w.currency_id} /></TableCell>
                        <TableCell><ProductionStatusBadge status={w.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{(w.approved_at ?? w.submitted_at ?? w.created_at)?.slice(0, 10) ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
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
